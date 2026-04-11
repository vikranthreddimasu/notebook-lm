# backend/notebooklm.spec
# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Notebook LM backend.

Build with:  pyinstaller notebooklm.spec --clean --noconfirm
Output:      dist/notebooklm-backend  (single binary, arm64)
"""
import os
import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# Collect data files for packages that bundle non-Python assets
sentence_transformers_datas = collect_data_files("sentence_transformers")
tokenizers_datas = collect_data_files("tokenizers")
chromadb_datas = collect_data_files("chromadb")
pydantic_datas = collect_data_files("pydantic")

# Collect all submodules for packages with dynamic imports
hidden_imports = (
    collect_submodules("chromadb")
    + collect_submodules("sentence_transformers")
    + collect_submodules("tokenizers")
    + collect_submodules("uvicorn")
    + collect_submodules("langchain_text_splitters")
    + collect_submodules("llama_index.core")
    + collect_submodules("llama_index.vector_stores.chroma")
    + collect_submodules("llama_index.llms.ollama")
    + [
        "tiktoken_ext",
        "tiktoken_ext.openai_public",
        "numpy",
        "scipy",
        "pypdf",
        "docx",
        "pptx",
        "httpx",
        "orjson",
        "psutil",
        "multipart",
        "starlette.middleware.cors",
    ]
)

# Bundled embedding model path — download before building if not cached
# sentence-transformers will have it in its cache; PyInstaller collects it via data_files

a = Analysis(
    ["launcher.py"],
    pathex=["."],
    binaries=[],
    datas=(
        sentence_transformers_datas
        + tokenizers_datas
        + chromadb_datas
        + pydantic_datas
        + [("notebooklm_backend", "notebooklm_backend")]
    ),
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "pytest",
        "pip",
        "tkinter",
        "_tkinter",
        "unittest",
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="notebooklm-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    target_arch="arm64",
)
