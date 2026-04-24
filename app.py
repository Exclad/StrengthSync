import threading
import webbrowser
from flask import Flask, render_template

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


def _open_browser():
    webbrowser.open("http://localhost:5000")


if __name__ == "__main__":
    threading.Timer(1.0, _open_browser).start()
    app.run(debug=False, port=5000)
