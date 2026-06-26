from flask import Flask, render_template, request, jsonify
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/games", methods=["GET"])
def get_games():
    res = supabase.table("games").select("*").order("created_at", desc=False).execute()
    return jsonify(res.data)


@app.route("/api/games", methods=["POST"])
def add_game():
    data = request.json
    rolls = data.get("rolls", {})
    # Store rolls as individual columns r2..r12 + winner + date + players + total
    row = {
        "winner":  data["winner"],
        "date":    data["date"],
        "players": data.get("players", 0),
        "total":   data["total"],
        "r2":  rolls.get("2",  0),
        "r3":  rolls.get("3",  0),
        "r4":  rolls.get("4",  0),
        "r5":  rolls.get("5",  0),
        "r6":  rolls.get("6",  0),
        "r7":  rolls.get("7",  0),
        "r8":  rolls.get("8",  0),
        "r9":  rolls.get("9",  0),
        "r10": rolls.get("10", 0),
        "r11": rolls.get("11", 0),
        "r12": rolls.get("12", 0),
    }
    res = supabase.table("games").insert(row).execute()
    return jsonify(res.data[0]), 201


@app.route("/api/games/<int:game_id>", methods=["DELETE"])
def delete_game(game_id):
    supabase.table("games").delete().eq("id", game_id).execute()
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
