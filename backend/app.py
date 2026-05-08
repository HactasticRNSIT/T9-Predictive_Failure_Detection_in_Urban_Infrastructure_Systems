"""
Urban Infrastructure Failure Prediction - Flask Backend
Rule-based RUL (Remaining Useful Life) predictor & anomaly detection.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
import time
import base64
import uuid
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# ── Supabase Setup ──
try:
    from supabase import create_client
    sb_url = os.environ.get("SUPABASE_URL", "")
    sb_key = os.environ.get("SUPABASE_KEY", "")
    if sb_url and sb_key:
        supabase = create_client(sb_url, sb_key)
        SUPABASE_AVAILABLE = True
        print("✅ Supabase connected successfully")
    else:
        supabase = None
        SUPABASE_AVAILABLE = False
        print("⚠ Supabase not configured — using local JSON fallback")
except ImportError:
    supabase = None
    SUPABASE_AVAILABLE = False
    print("⚠ supabase not installed — using local JSON fallback")

# ── Gemini AI Setup ──
GEMINI_MODELS = ["gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-2.0-flash"]
try:
    from google import genai
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if api_key and not api_key.startswith("your_"):
        ai_client = genai.Client(api_key=api_key)
        AI_AVAILABLE = True
        print("✅ Gemini AI connected successfully")
    else:
        ai_client = None
        AI_AVAILABLE = False
        print("⚠ GEMINI_API_KEY not set — chatbot in smart fallback mode")
except ImportError:
    ai_client = None
    AI_AVAILABLE = False
    print("⚠ google-genai not installed — chatbot in smart fallback mode")

SYSTEM_PROMPT = """You are InfraWatch AI, a highly advanced, expert assistant for urban infrastructure monitoring.
You have access to real-time data about infrastructure assets like bridges, roads, and pipelines.
Your primary goals are to:
1. Provide accurate, data-driven explanations of risk assessments and Remaining Useful Life (RUL) estimates.
2. Recommend immediate maintenance priorities for critical assets.
3. Be highly interactive, conversational, and user-friendly. Ask follow-up questions to clarify the user's needs when appropriate.
4. If an asset is in 'critical' condition, emphasize the urgency and suggest immediate inspection.

Guidelines:
- Keep responses concise but highly informative (2-4 sentences unless the user asks for a detailed breakdown).
- Use plain, professional language suitable for engineers and city planners.
- Always reference specific assets by their ID and name when discussing them.
- Format your response nicely using bullet points if listing multiple items.

Current infrastructure data:
{asset_context}
"""

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "assets.json")

# Centroid of the original NYC mock data
NYC_CENTER = {"lat": 40.745, "lng": -73.96}

# In-memory storage for user-generated reports
user_reports = []


def load_assets():
    """Load asset data from Supabase or fall back to local JSON."""
    if SUPABASE_AVAILABLE:
        try:
            result = supabase.table("assets").select("*").execute()
            assets = []
            for row in result.data:
                assets.append({
                    "id": row["id"],
                    "name": row["name"],
                    "type": row["type"],
                    "lat": row["lat"],
                    "lng": row["lng"],
                    "age": row["age"],
                    "maxAge": row["max_age"],
                    "load": row["load"],
                    "inspectionScore": row["inspection_score"],
                    "lastMaintenance": row["last_maintenance"],
                    "history": json.loads(row["history"]) if isinstance(row["history"], str) else row.get("history", [])
                })
            return assets
        except Exception as e:
            print(f"Supabase load error, falling back to JSON: {e}")
    
    # Fallback to local JSON
    with open(DATA_PATH, "r") as f:
        return json.load(f)


def load_reports():
    """Load user reports from Supabase or fall back to in-memory list."""
    if SUPABASE_AVAILABLE:
        try:
            result = supabase.table("reports").select("*").order("created_at", desc=True).execute()
            reports = []
            for row in result.data:
                reports.append({
                    "id": row["report_id"],
                    "lat": row["lat"],
                    "lng": row["lng"],
                    "description": row["description"],
                    "image": row.get("image_url"),
                    "timestamp": row["timestamp"]
                })
            return reports
        except Exception as e:
            print(f"Supabase reports load error: {e}")
    return user_reports


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
    """Build a text summary of all assets and user reports for AI context."""
    assets = load_assets()
    lines = ["INFRASTRUCTURE ASSETS:"]
    for a in assets:
        p = compute_risk(a)
        lines.append(
            f"- {a['id']} {a['name']} ({a['type']}): age={a['age']}/{a['maxAge']}yr, "
            f"load={a['load']}%, inspection={a['inspectionScore']}/100, "
            f"lastMaint={a['lastMaintenance']}yr ago → "
            f"status={p['status']}, risk={p['riskScore']}, RUL={p['rulMonths']}mo, "
            f"anomaly={'YES' if p['anomaly'] else 'no'}"
        )
    
    if user_reports:
        lines.append("\nUSER-SUBMITTED PROBLEM REPORTS:")
        for r in user_reports:
            lines.append(f"- Report {r['id']} at ({r['lat']}, {r['lng']}): {r['description']} (Time: {r['timestamp']})")
    else:
        lines.append("\nNo user reports submitted yet.")
        
    return "\n".join(lines)


def smart_fallback(message, assets=None, reports=None):
    """A comprehensive rule-based chatbot that handles many conversation topics."""
    if assets is None:
        assets = load_assets()
    if reports is None:
        reports = user_reports
    
    msg = message.lower().strip()
    scored_assets = []
    for a in assets:
        p = compute_risk(a)
        scored_assets.append({**a, **p})
    
    critical = [a for a in scored_assets if a["status"] == "critical"]
    watch = [a for a in scored_assets if a["status"] == "watch"]
    stable = [a for a in scored_assets if a["status"] == "stable"]
    bridges = [a for a in scored_assets if a["type"].lower() == "bridge"]
    roads = [a for a in scored_assets if a["type"].lower() == "road"]
    pipelines = [a for a in scored_assets if a["type"].lower() == "pipeline"]

    # Greeting
    if any(w in msg for w in ["hello", "hi ", "hey", "good morning", "good afternoon", "good evening", "greetings"]):
        return f"Hello! I'm InfraWatch AI 🏗️\n\nI'm monitoring {len(scored_assets)} infrastructure assets in your area. Here's a quick snapshot:\n• 🔴 {len(critical)} Critical\n• 🟡 {len(watch)} Watch\n• 🟢 {len(stable)} Stable\n\nWhat would you like to know? Try asking about critical assets, maintenance, bridges, roads, or user reports!"

    # Thank you
    if any(w in msg for w in ["thank", "thanks", "appreciated"]):
        return "You're welcome! Feel free to ask anything else about the infrastructure. I'm here to help! 😊"

    # Who are you / what can you do
    if any(w in msg for w in ["who are you", "what are you", "what can you do", "help", "capabilities"]):
        return "I'm InfraWatch AI — your infrastructure monitoring assistant! Here's what I can help with:\n• 🔴 Check critical assets and risks\n• 🛠️ Maintenance recommendations\n• 🌉 Info on bridges, roads, and pipelines\n• 📊 Asset status and RUL estimates\n• ⚠️ User-reported problems\n• 📷 How to report new issues\n\nJust ask!"

    # User reports
    if any(w in msg for w in ["report", "problem", "issue", "complaint", "user report"]):
        if "how" in msg or "submit" in msg or "add" in msg or "create" in msg:
            return "To report a problem:\n1️⃣ Click anywhere on the map where you see the issue\n2️⃣ A form will pop up with your camera\n3️⃣ Capture a photo of the problem\n4️⃣ Add a description and hit Upload\n\nYour report will appear as a purple marker on the map for everyone to see!"
        if reports:
            reports_list = "\n".join([f"• {r['description']} (ID: {r['id']}, reported at {r['timestamp']})" for r in reports[-5:]])
            return f"There are {len(reports)} user-reported problems:\n{reports_list}\n\nClick on the purple markers on the map to see photos and details."
        return "No problems have been reported yet. You can report one by clicking anywhere on the map!"

    # Critical assets
    if any(w in msg for w in ["critical", "danger", "urgent", "emergency", "worst", "bad"]):
        if critical:
            details = "\n".join([f"• 🔴 {c['name']} (ID: {c['id']}) — Risk: {c['riskScore']:.0%}, RUL: ~{c['rulMonths']} months, Load: {c['load']}%" for c in critical])
            return f"⚠️ {len(critical)} CRITICAL assets need immediate attention:\n{details}\n\nI recommend scheduling inspections for these assets as soon as possible."
        return "✅ Great news! No assets are currently in critical condition. All systems are operating within safe parameters."

    # Maintenance
    if any(w in msg for w in ["maintenance", "maintain", "repair", "fix", "inspect", "inspection"]):
        priority = sorted(scored_assets, key=lambda x: x["riskScore"], reverse=True)[:3]
        details = "\n".join([f"• {a['name']} (ID: {a['id']}) — Risk: {a['riskScore']:.0%}, last maintained {a['lastMaintenance']} yrs ago" for a in priority])
        return f"🛠️ Top 3 maintenance priorities:\n{details}\n\nFocus on assets with the highest risk scores and longest time since last maintenance."

    # Bridges
    if any(w in msg for w in ["bridge", "bridges"]):
        if bridges:
            details = "\n".join([f"• {b['name']} (ID: {b['id']}) — Status: {b['status'].upper()}, Age: {b['age']}/{b['maxAge']} yrs, RUL: ~{b['rulMonths']} mo" for b in bridges])
            crit_bridges = [b for b in bridges if b["status"] == "critical"]
            return f"🌉 Bridge Summary ({len(bridges)} total, {len(crit_bridges)} critical):\n{details}"
        return "No bridges found in the current monitoring area."

    # Roads
    if any(w in msg for w in ["road", "roads", "highway", "street"]):
        if roads:
            details = "\n".join([f"• {r['name']} (ID: {r['id']}) — Status: {r['status'].upper()}, Load: {r['load']}%, RUL: ~{r['rulMonths']} mo" for r in roads])
            return f"🛣️ Road Summary ({len(roads)} total):\n{details}"
        return "No roads found in the current monitoring area."

    # Pipelines
    if any(w in msg for w in ["pipeline", "pipe", "water", "gas", "sewer"]):
        if pipelines:
            details = "\n".join([f"• {p['name']} (ID: {p['id']}) — Status: {p['status'].upper()}, Age: {p['age']} yrs, Inspection: {p['inspectionScore']}/100" for p in pipelines])
            return f"🚧 Pipeline Summary ({len(pipelines)} total):\n{details}"
        return "No pipelines found in the current monitoring area."

    # Status / overview / summary
    if any(w in msg for w in ["status", "overview", "summary", "how many", "dashboard", "overall", "total"]):
        return f"📊 Infrastructure Overview:\n• Total Assets: {len(scored_assets)}\n• 🔴 Critical: {len(critical)}\n• 🟡 Watch: {len(watch)}\n• 🟢 Stable: {len(stable)}\n• 📝 User Reports: {len(reports)}\n\nWould you like details on any specific category?"

    # RUL / remaining useful life
    if any(w in msg for w in ["rul", "remaining", "life", "lifespan", "how long", "last"]):
        shortest = sorted(scored_assets, key=lambda x: x["rulMonths"])[:3]
        details = "\n".join([f"• {a['name']} — ~{a['rulMonths']} months remaining (Risk: {a['riskScore']:.0%})" for a in shortest])
        return f"⏳ Assets with shortest Remaining Useful Life:\n{details}\n\nThese should be prioritized for inspection and potential replacement."

    # Age
    if any(w in msg for w in ["old", "oldest", "age", "aging"]):
        oldest = sorted(scored_assets, key=lambda x: x["age"] / x["maxAge"], reverse=True)[:3]
        details = "\n".join([f"• {a['name']} — {a['age']} yrs old (max: {a['maxAge']} yrs, {a['age']/a['maxAge']:.0%} of lifespan used)" for a in oldest])
        return f"📅 Most aged assets:\n{details}"

    # Load
    if any(w in msg for w in ["load", "stress", "capacity", "overload"]):
        highest_load = sorted(scored_assets, key=lambda x: x["load"], reverse=True)[:3]
        details = "\n".join([f"• {a['name']} — Load: {a['load']}%, Status: {a['status'].upper()}" for a in highest_load])
        return f"⚡ Highest load assets:\n{details}\n\nAssets above 80% load should be monitored closely for structural stress."

    # Specific asset lookup by ID
    for a in scored_assets:
        if a["id"].lower() in msg or a["name"].lower() in msg:
            return f"📝 Asset Detail: {a['name']} (ID: {a['id']})\n• Type: {a['type']}\n• Status: {a['status'].upper()}\n• Age: {a['age']}/{a['maxAge']} years\n• Load: {a['load']}%\n• Inspection Score: {a['inspectionScore']}/100\n• Last Maintenance: {a['lastMaintenance']} yrs ago\n• Risk Score: {a['riskScore']:.0%}\n• RUL: ~{a['rulMonths']} months\n• Anomaly: {'YES ⚠️' if a['anomaly'] else 'No'}"

    # Fallback
    return f"I can help you with:\n• Asset status & risks — try \"show critical assets\"\n• Maintenance priorities — try \"what needs maintenance?\"\n• Infrastructure types — try \"show bridges\" or \"show roads\"\n• User reports — try \"any reported problems?\"\n• RUL estimates — try \"which assets are near end of life?\"\n• Asset details — try typing an asset name or ID\n\nCurrently monitoring {len(scored_assets)} assets with {len(critical)} in critical condition."


@app.route("/api/chat", methods=["POST"])
def chat():
    """AI chatbot endpoint with Gemini + smart fallback."""
    data = request.json or {}
    message = data.get("message", "").strip()
    history_data = data.get("history", [])

    if not message:
        return jsonify({"error": "No message provided"}), 400

    # If Gemini is available, try it with multiple models and retry
    if AI_AVAILABLE:
        for model_name in GEMINI_MODELS:
            for attempt in range(2):
                try:
                    context = build_asset_context()
                    system_msg = SYSTEM_PROMPT.format(asset_context=context)

                    contents = []
                    for h in history_data[-10:]:
                        role = "model" if h["role"] == "model" else "user"
                        contents.append(genai.types.Content(
                            role=role,
                            parts=[genai.types.Part(text=h["content"])]
                        ))
                    contents.append(genai.types.Content(
                        role="user",
                        parts=[genai.types.Part(text=message)]
                    ))

                    response = ai_client.models.generate_content(
                        model=model_name,
                        contents=contents,
                        config=genai.types.GenerateContentConfig(
                            system_instruction=system_msg,
                            max_output_tokens=500,
                            temperature=0.7,
                        )
                    )
                    
                    if response.text:
                        return jsonify({"response": response.text})
                except Exception as e:
                    err = str(e)
                    print(f"Gemini {model_name} attempt {attempt+1} error: {err}")
                    if "429" in err or "RESOURCE_EXHAUSTED" in err:
                        time.sleep(2 * (attempt + 1))  # backoff
                        continue
                    break  # non-quota error, try next model
        
        # All models failed — use smart fallback
        print("All Gemini models exhausted, using smart fallback")
    
    # Smart fallback chatbot
    reply = smart_fallback(message)
    return jsonify({"response": reply})


@app.route("/api/reports", methods=["GET", "POST"])
def manage_reports():
    """Handle user-submitted problem reports with Supabase storage."""
    if request.method == "POST":
        data = request.json
        if not data or "lat" not in data or "lng" not in data or "description" not in data:
            return jsonify({"error": "Missing required fields"}), 400
        
        image_data = data.get("image", None)
        image_url = None
        report_id = f"REP-{uuid.uuid4().hex[:6].upper()}"
        timestamp_str = data.get("timestamp", "Just now")

        # Upload image to Supabase Storage if available
        if SUPABASE_AVAILABLE and image_data and image_data.startswith("data:image"):
            try:
                # Extract base64 data from data URL
                header, b64_data = image_data.split(",", 1)
                ext = "jpg" if "jpeg" in header else "png"
                file_bytes = base64.b64decode(b64_data)
                file_name = f"{report_id}.{ext}"
                
                supabase.storage.from_("report-images").upload(
                    file_name,
                    file_bytes,
                    {"content-type": f"image/{ext}"}
                )
                image_url = supabase.storage.from_("report-images").get_public_url(file_name)
                print(f"✅ Image uploaded: {file_name}")
            except Exception as e:
                print(f"Image upload error: {e}")
                image_url = image_data  # fallback to base64
        else:
            image_url = image_data  # keep base64 if no Supabase

        report = {
            "id": report_id,
            "lat": data["lat"],
            "lng": data["lng"],
            "description": data["description"],
            "image": image_url,
            "timestamp": timestamp_str
        }

        # Save to Supabase
        if SUPABASE_AVAILABLE:
            try:
                supabase.table("reports").insert({
                    "report_id": report_id,
                    "lat": data["lat"],
                    "lng": data["lng"],
                    "description": data["description"],
                    "image_url": image_url,
                    "timestamp": timestamp_str
                }).execute()
                print(f"✅ Report {report_id} saved to Supabase")
            except Exception as e:
                print(f"Supabase report save error: {e}")
                user_reports.append(report)  # fallback
        else:
            user_reports.append(report)

        return jsonify(report), 201
    
    # GET — load from Supabase or memory
    return jsonify(load_reports())


if __name__ == "__main__":
    # Increase max request size to 16MB for image uploads
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
    
    # Run with SSL so HTTPS frontend can reach the API
    try:
        app.run(debug=True, host="0.0.0.0", port=5000, ssl_context='adhoc')
    except Exception:
        print("⚠ Could not start with SSL, falling back to HTTP")
        app.run(debug=True, host="0.0.0.0", port=5000)
