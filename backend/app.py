"""
Urban Infrastructure Failure Prediction - Flask Backend
Rule-based RUL (Remaining Useful Life) predictor & anomaly detection.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# ── Gemini AI Setup ──
try:
    import google.generativeai as genai
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if api_key and not api_key.startswith("your_"):
        genai.configure(api_key=api_key)
        AI_MODEL = "gemini-1.5-flash"
        AI_AVAILABLE = True
    else:
        AI_AVAILABLE = False
        print("⚠ GEMINI_API_KEY not set — chatbot disabled")
except ImportError:
    AI_AVAILABLE = False
    print("⚠ google-generativeai not installed — chatbot disabled")

SYSTEM_PROMPT = """You are InfraWatch AI, a highly advanced conversational AI (similar to ChatGPT) tailored for urban infrastructure.
You have access to real-time data about infrastructure assets like bridges, roads, and pipelines.

Your primary goals are to:
1. Be highly conversational and friendly. Reply to all greetings (like 'hi', 'hello', 'how are you') naturally.
2. Answer ANY questions the user asks. If they ask about general infrastructure problems, civil engineering, or even off-topic subjects, answer them intelligently!
3. Provide accurate explanations of risk assessments and Remaining Useful Life (RUL) estimates.
4. Recommend immediate maintenance priorities for critical assets.

Guidelines:
- Act like a helpful, intelligent human assistant.
- Use plain, professional language.
- Always reference specific assets by their ID and name when discussing the provided data.
- If the user asks something outside your dataset, use your general knowledge to answer them anyway.

Current infrastructure data:
{asset_context}
"""

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "assets.json")

# Centroid of the original NYC mock data
NYC_CENTER = {"lat": 40.745, "lng": -73.96}


def load_assets():
    """Load mock asset data from JSON file."""
    with open(DATA_PATH, "r") as f:
        return json.load(f)


def recenter_assets(assets, user_lat, user_lng):
    """Shift all asset coordinates so they surround the user's location."""
    recentered = []
    for asset in assets:
        a = dict(asset)
        a["lat"] = user_lat + (asset["lat"] - NYC_CENTER["lat"])
        a["lng"] = user_lng + (asset["lng"] - NYC_CENTER["lng"])
        recentered.append(a)
    return recentered


def compute_risk(asset):
    """
    Weighted scoring model for risk assessment.
    Factors: age ratio (20%), load (25%), inspection deficit (30%), maintenance gap (25%).
    Returns risk score, RUL in months, anomaly flag, and status.
    """
    age_factor = min(asset["age"] / asset["maxAge"], 1.0)
    load_factor = min(asset["load"] / 100.0, 1.0)
    inspection_factor = 1.0 - (asset["inspectionScore"] / 100.0)
    maintenance_factor = min(asset["lastMaintenance"] / 10.0, 1.0)

    risk_score = (
        0.20 * age_factor
        + 0.25 * load_factor
        + 0.30 * inspection_factor
        + 0.25 * maintenance_factor
    )
    risk_score = max(0.0, min(1.0, risk_score))

    # Remaining Useful Life: linear mapping from risk score
    rul_months = max(1, round((1.0 - risk_score) * 120))

    anomaly = risk_score > 0.6

    if risk_score < 0.35:
        status = "stable"
    elif risk_score < 0.6:
        status = "watch"
    else:
        status = "critical"

    return {
        "riskScore": round(risk_score, 3),
        "rulMonths": rul_months,
        "anomaly": anomaly,
        "status": status,
    }


def generate_explanation(asset, prediction):
    """Generate a plain-language risk explanation for an asset."""
    factors = []

    if asset["age"] / asset["maxAge"] > 0.7:
        factors.append(f"aging ({asset['age']}yr old)")
    if asset["load"] > 75:
        factors.append(f"high load ({asset['load']}%)")
    if asset["inspectionScore"] < 40:
        factors.append(f"low inspection score ({asset['inspectionScore']}/100)")
    if asset["lastMaintenance"] > 3:
        factors.append(f"{asset['lastMaintenance']}yr since maintenance")

    if not factors:
        factors.append("moderate wear indicators")

    factor_str = " + ".join(factors)
    rul = prediction["rulMonths"]

    return f"{asset['name']}: {factor_str} → Failure risk in ~{rul} months"


@app.route("/api/assets")
def get_assets():
    """Return all assets with computed risk predictions, optionally recentered."""
    assets = load_assets()
    user_lat = request.args.get("lat", type=float)
    user_lng = request.args.get("lng", type=float)
    if user_lat is not None and user_lng is not None:
        assets = recenter_assets(assets, user_lat, user_lng)
    result = []
    for asset in assets:
        prediction = compute_risk(asset)
        result.append({**asset, **prediction})
    return jsonify(result)


@app.route("/api/predict", methods=["POST"])
def predict():
    """Accept asset attributes and return RUL + anomaly prediction."""
    data = request.json
    if not data:
        return jsonify({"error": "No JSON data provided"}), 400

    required = ["age", "maxAge", "load", "inspectionScore", "lastMaintenance"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    prediction = compute_risk(data)
    return jsonify(prediction)


@app.route("/api/warnings")
def get_warnings():
    """Return top 5 at-risk assets with plain-language explanations."""
    assets = load_assets()
    user_lat = request.args.get("lat", type=float)
    user_lng = request.args.get("lng", type=float)
    if user_lat is not None and user_lng is not None:
        assets = recenter_assets(assets, user_lat, user_lng)
    scored = []
    for asset in assets:
        prediction = compute_risk(asset)
        explanation = generate_explanation(asset, prediction)
        scored.append({**asset, **prediction, "explanation": explanation})

    scored.sort(key=lambda x: x["riskScore"], reverse=True)
    return jsonify(scored[:5])


def build_asset_context():
    """Build a text summary of all assets for AI context."""
    assets = load_assets()
    lines = []
    for a in assets:
        p = compute_risk(a)
        lines.append(
            f"- {a['id']} {a['name']} ({a['type']}): age={a['age']}/{a['maxAge']}yr, "
            f"load={a['load']}%, inspection={a['inspectionScore']}/100, "
            f"lastMaint={a['lastMaintenance']}yr ago → "
            f"status={p['status']}, risk={p['riskScore']}, RUL={p['rulMonths']}mo, "
            f"anomaly={'YES' if p['anomaly'] else 'no'}"
        )
    return "\n".join(lines)


@app.route("/api/chat", methods=["POST"])
def chat():
    """AI chatbot endpoint using Google Gemini."""
    data = request.json or {}
    message = data.get("message", "").strip()
    history_data = data.get("history", [])
    location_name = data.get("locationName", "Unknown Location")
    selected_asset = data.get("selectedAsset", None)

    if not message:
        return jsonify({"error": "No message provided"}), 400



    try:
        context = build_asset_context()
        system_msg = SYSTEM_PROMPT.format(asset_context=context)
        
        # Inject context about the user's current view
        system_msg += f"\n\nCURRENT USER VIEW:"
        system_msg += f"\n- The user is currently exploring the area: {location_name}."
        if selected_asset:
            system_msg += f"\n- The user has currently clicked on and selected the following asset: {selected_asset['name']} (ID: {selected_asset['id']}, Type: {selected_asset['type']})."
            system_msg += f" If the user says 'this asset', 'it', or 'this problem', they are referring to this specific asset. Be sure to analyze its specific data."
        else:
            system_msg += f"\n- The user has not selected any specific asset. If they ask about infrastructure problems, give them an overview of {location_name}."

        if not AI_AVAILABLE:
            # Use g4f (GPT4Free) as a fallback if the API key isn't provided
            from g4f.client import Client
            client = Client()
            messages = [{"role": "system", "content": system_msg}]
            for h in history_data[-10:]:
                role = "assistant" if h["role"] == "model" else "user"
                messages.append({"role": role, "content": h["content"]})
            messages.append({"role": "user", "content": message})

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages
            )
            reply = response.choices[0].message.content
            return jsonify({"response": reply})

        # Initialize Gemini Model with system instruction
        model = genai.GenerativeModel(
            model_name=AI_MODEL,
            system_instruction=system_msg
        )

        # Format history for Gemini (roles must be 'user' or 'model')
        formatted_history = []
        for h in history_data[-10:]:
            # Frontend uses 'model' and 'user', Gemini uses 'model' and 'user'
            role = "model" if h["role"] == "model" else "user"
            formatted_history.append({
                "role": role,
                "parts": [h["content"]]
            })

        # Start chat session with history
        chat_session = model.start_chat(history=formatted_history)
        
        # Send new message
        response = chat_session.send_message(message)
        
        return jsonify({"response": response.text})
    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
