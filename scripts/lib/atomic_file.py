"""Crash-safe file replacement for active Python scripts."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path


def atomic_write_text(target: Path, content: str, *, encoding: str = "utf-8") -> None:
    destination = Path(target)
    destination.parent.mkdir(parents=True, exist_ok=True)
    mode = destination.stat().st_mode & 0o777 if destination.exists() else None
    temporary_name = ""
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding=encoding,
            dir=destination.parent,
            prefix=f".{destination.name}.writing-",
            delete=False,
        ) as handle:
            temporary_name = handle.name
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        if mode is not None:
            os.chmod(temporary_name, mode)
        os.replace(temporary_name, destination)
        temporary_name = ""
    finally:
        if temporary_name:
            try:
                os.unlink(temporary_name)
            except FileNotFoundError:
                pass
