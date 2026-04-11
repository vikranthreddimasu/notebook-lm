"""PyInstaller entry point for the Notebook LM backend.

Starts uvicorn with the FastAPI app. Accepts an optional --port argument.
"""
import sys
import uvicorn

from notebooklm_backend.app import create_app


def main() -> None:
    port = 8000
    for i, arg in enumerate(sys.argv[1:], 1):
        if arg == "--port" and i < len(sys.argv) - 1:
            port = int(sys.argv[i + 1])
            break

    app = create_app()
    uvicorn.run(app, host="127.0.0.1", port=port)


if __name__ == "__main__":
    main()
