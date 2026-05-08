# InfraWatch — Start Script
# Launches Flask backend (port 5000) and Vite frontend (port 5173)

$env:Path = "C:\Program Files\nodejs;" + $env:Path

Write-Host "`n  ⬡ InfraWatch — Urban Infrastructure Monitor" -ForegroundColor Cyan
Write-Host "  Starting backend and frontend servers...`n" -ForegroundColor DarkGray

# Start Flask backend
$backend = Start-Process -NoNewWindow -PassThru -FilePath "python" -ArgumentList "app.py" -WorkingDirectory "$PSScriptRoot\backend"
Write-Host "  [✓] Flask backend starting on http://localhost:5000" -ForegroundColor Green

# Start Vite frontend
$frontend = Start-Process -NoNewWindow -PassThru -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory "$PSScriptRoot\frontend"
Write-Host "  [✓] Vite frontend starting on http://localhost:5173" -ForegroundColor Green

Write-Host "`n  Open http://localhost:5173 in your browser.`n" -ForegroundColor Yellow
Write-Host "  Press Ctrl+C to stop both servers.`n" -ForegroundColor DarkGray

try {
    Wait-Process -Id $backend.Id
}
finally {
    Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -ErrorAction SilentlyContinue
    Write-Host "`n  Servers stopped." -ForegroundColor Red
}
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

# ── OpenAI Setup ──
try:
    from openai import OpenAI
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if api_key and not api_key.startswith("your_"):
        ai_client = OpenAI(api_key=api_key)
        AI_MODEL = "gpt-4o-mini"
        AI_AVAILABLE = True
    else:
        AI_AVAILABLE = False
        print("⚠ OPENAI_API_KEY not set — chatbot disabled")
except ImportError:
    AI_AVAILABLE = False
    print("⚠ openai not installed — chatbot disabled")

SYSTEM_PROMPT = """You are InfraWatch AI, an expert assistant for urban infrastructure monitoring.
You have access to real-time data about infrastructure assets (bridges, roads, pipelines).
You help engineers and city planners by:
- Explaining risk assessments and remaining useful life estimates
- Recommending maintenance priorities
- Answering questions about infrastructure health, failure modes, and best practices
- Providing actionable insights based on the data

Keep responses concise (2-4 sentences unless asked for detail). Use plain language.
When referencing specific assets, mention their ID and name.

Current infrastructure data:
{asset_context}
"""

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "assets.json")
NYC_CENTER = {"lat": 40.745, "lng": -73.96}

def load_assets():
    with open(DATA_PATH, "r") as f:
        return json.load(f)

def recenter_assets(assets, user_lat, user_lng):
    recentered = []
    for asset in assets:
        a = dict(asset)
        a["lat"] = user_lat + (asset["lat"] - NYC_CENTER["lat"])
        a["lng"] = user_lng + (asset["lng"] - NYC_CENTER["lng"])
        recentered.append(a)
    return recentered

def compute_risk(asset):
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
    factors = []
    if asset["age"] / asset["maxAge"] > 0.7: factors.append(f"aging ({asset['age']}yr old)")
    if asset["load"] > 75: factors.append(f"high load ({asset['load']}%)")
    if asset["inspectionScore"] < 40: factors.append(f"low inspection score ({asset['inspectionScore']}/100)")
    if asset["lastMaintenance"] > 3: factors.append(f"{asset['lastMaintenance']}yr since maintenance")
    if not factors: factors.append("moderate wear indicators")
    
    factor_str = " + ".join(factors)
    return f"{asset['name']}: {factor_str} → Failure risk in ~{prediction['rulMonths']} months"

@app.route("/api/assets")
def get_assets():
    assets = load_assets()
    user_lat = request.args.get("lat", type=float)
    user_lng = request.args.get("lng", type=float)
    if user_lat is not None and user_lng is not None:
        assets = recenter_assets(assets, user_lat, user_lng)
    result = [{**asset, **compute_risk(asset)} for asset in assets]
    return jsonify(result)

@app.route("/api/chat", methods=["POST"])
def chat():
    """AI chatbot endpoint using OpenAI."""
    data = request.json or {}
    message = data.get("message", "").strip()
    history = data.get("history", [])

    if not message: return jsonify({"error": "No message provided"}), 400
    if not AI_AVAILABLE:
        return jsonify({"response": "AI chatbot is not configured."})

    try:
        # Code logic for OpenAI context generation...
        system_msg = SYSTEM_PROMPT.format(asset_context="...context...")
        messages = [{"role": "system", "content": system_msg}]
        messages.append({"role": "user", "content": message})

        response = ai_client.chat.completions.create(
            model=AI_MODEL,
            messages=messages,
            max_tokens=500,
            temperature=0.7,
        )
        return jsonify({"response": response.choices[0].message.content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
import { useState, useEffect, useCallback } from 'react'
import './index.css'
import StatsBar from './components/StatsBar'
import MapView from './components/MapView'
import WarningFeed from './components/WarningFeed'
import AssetDetail from './components/AssetDetail'
import Predictor from './components/Predictor'
import Chatbot from './components/Chatbot'
import LocationSearch from './components/LocationSearch'

const API = 'http://localhost:5000/api'

export default function App() {
  const [assets, setAssets] = useState([])
  const [warnings, setWarnings] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState(null)
  
  // Fetch assets from API with optional location
  const fetchData = useCallback(async (lat, lng) => {
    try {
      const qs = lat != null && lng != null ? `?lat=${lat}&lng=${lng}` : ''
      const [a, w] = await Promise.all([
        fetch(`${API}/assets${qs}`).then(r => r.json()),
        fetch(`${API}/warnings${qs}`).then(r => r.json()),
      ])
      setAssets(a)
      setWarnings(w)
    } catch (err) {
      console.error('API fetch failed:', err)
    }
    setLoading(false)
  }, [])

  // Geolocation trigger on mount
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude])
        fetchData(pos.coords.latitude, pos.coords.longitude)
      },
      () => fetchData()
    )
  }, [fetchData])

  if (loading) return <div className="loading-container"><div className="spinner" /></div>

  return (
    <>
      <header className="app-header">
        <div className="logo">⬡ InfraWatch</div>
        <LocationSearch currentLocation={userLocation} onLocationChange={(lat, lng) => fetchData(lat, lng)} />
      </header>

      <div className="main-layout">
        <MapView assets={assets} onSelect={setSelected} selected={selected} userLocation={userLocation} />

        <div className="right-panel">
          {selected ? <AssetDetail asset={selected} onClose={() => setSelected(null)} /> : <Predictor />}
          <div className="panel-section warning-feed">
            <div className="panel-title">🔔 Early Warning Feed</div>
            <WarningFeed warnings={warnings} onSelect={(w) => setSelected(assets.find(a => a.id === w.id))} />
          </div>
        </div>
      </div>
      <Chatbot />
    </>
  )
}
# 1. Update the Windows User PATH permanently to include Node.js
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", $userPath + ";C:\Program Files\nodejs\", "User")

# 2. Allow PowerShell scripts like npm.ps1 to execute
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force