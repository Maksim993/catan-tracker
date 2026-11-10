"""Local sandbox: python tools/preview.py [--load-live]. No third-party dependencies."""
import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / ".local" / "preview-games.json"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5050)
    parser.add_argument("--load-live", action="store_true",
                        help="Read a snapshot from Render if no local data exists")
    args = parser.parse_args()
    DATA.parent.mkdir(exist_ok=True)
    if not DATA.exists():
        rows = []
        if args.load_live:
            try:
                with urlopen("https://catan-tracker.onrender.com/api/games", timeout=45) as response:
                    rows = json.load(response)
                if not isinstance(rows, list):
                    raise ValueError("Expected a list of games")
                print(f"Loaded a read-only snapshot: {len(rows)} games", flush=True)
            except Exception as error:
                print(f"Live snapshot unavailable ({type(error).__name__}); starting empty", flush=True)
        DATA.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

    class Handler(BaseHTTPRequestHandler):
        def send(self, data, status=200, content_type="application/json; charset=utf-8"):
            body = data.encode("utf-8") if isinstance(data, str) else json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == "/":
                html = (ROOT / "templates" / "index.html").read_text(encoding="utf-8")
                banner = '<div style="background:#FFF3CD;color:#5C3A1E;padding:12px;text-align:center;font:14px sans-serif">Предпросмотр · Игры сохраняются только на этом компьютере. Семейная база Supabase не изменяется.</div>'
                self.send(html.replace("<body>", "<body>" + banner), content_type="text/html; charset=utf-8")
            elif self.path == "/api/games":
                self.send(json.loads(DATA.read_text(encoding="utf-8")))
            else:
                self.send({"error": "Not found"}, 404)

        def do_POST(self):
            if self.path != "/api/games":
                return self.send({"error": "Not found"}, 404)
            data = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            rows = json.loads(DATA.read_text(encoding="utf-8"))
            row = {key: data[key] for key in ("winner", "date", "players", "total")}
            row["id"] = max((r["id"] for r in rows), default=0) + 1
            row.update({f"r{n}": data["rolls"].get(str(n), 0) for n in range(2, 13)})
            rows.append(row)
            DATA.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
            self.send(row, 201)

        def do_DELETE(self):
            prefix = "/api/games/"
            if not self.path.startswith(prefix) or not self.path[len(prefix):].isdigit():
                return self.send({"error": "Not found"}, 404)
            game_id = int(self.path[len(prefix):])
            rows = json.loads(DATA.read_text(encoding="utf-8"))
            DATA.write_text(json.dumps([r for r in rows if r["id"] != game_id], ensure_ascii=False, indent=2), encoding="utf-8")
            self.send({"ok": True})

    print(f"Local sandbox: http://127.0.0.1:{args.port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
