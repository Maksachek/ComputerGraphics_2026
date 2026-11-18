import threading
import webbrowser
from server import run_server


def main() -> None:
    host = "127.0.0.1"
    port = 8000
    server = run_server(host, port)
    url = f"http://{host}:{port}"
    print(f"Сервер запущен: {url} (для остановки нажмите Ctrl+C)")

    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nОстановка сервера...")
        server.shutdown()


if __name__ == "__main__":
    main()