"""
FastAPI backend for the Tkinter GUI builder.

This backend exposes a single endpoint `/generate_code` which accepts a JSON
representation of a Tkinter layout and returns a Python script as plain text.

The JSON format expected is simple: a list of widgets, each with at least
`type`, `id`, `x`, `y`, `width` and `height` coordinates. Additional
properties such as `text` are used to populate widget attributes. Only a
handful of Tkinter widgets are supported in this MVP (Button, Label,
Entry, Frame and Menu).

Example request body:
```
{
  "widgets": [
    {"id": "w1", "type": "Button", "text": "Click me", "x": 10, "y": 20, "width": 100, "height": 30},
    {"id": "w2", "type": "Label", "text": "Hello", "x": 120, "y": 20, "width": 100, "height": 30}
  ]
}
```

Response:
```
{
  "code": "import tkinter as tk\n..."
}
```

This MVP does not spawn a live preview; it simply returns code. A future
extension could run the generated code in a headless Tkinter environment and
stream screenshots back to the client.
"""

from typing import List, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator


class Widget(BaseModel):
    """Pydantic model representing a widget on the canvas."""

    id: str = Field(..., description="Unique identifier for the widget")
    type: str = Field(..., description="Tkinter widget type (Button, Label, Entry, Frame, Menu)")
    x: int = Field(..., description="X coordinate relative to the window")
    y: int = Field(..., description="Y coordinate relative to the window")
    width: int = Field(..., description="Width of the widget")
    height: int = Field(..., description="Height of the widget")
    text: str | None = Field(None, description="Optional text for widgets that support text")

    @validator("type")
    def validate_type(cls, v: str) -> str:
        supported = {"Button", "Label", "Entry", "Frame", "Menu"}
        if v not in supported:
            raise ValueError(f"Unsupported widget type: {v}")
        return v


class Layout(BaseModel):
    """Pydantic model representing the entire layout."""

    widgets: List[Widget]


def generate_tkinter_code(layout: Layout) -> str:
    """Generate a Tkinter script from the given layout.

    The function builds Python code that instantiates each widget and calls
    `.place()` with the stored geometry. It returns a single string containing
    the full script, including imports and a root mainloop.

    Args:
        layout: Layout object describing the widgets and their properties.

    Returns:
        A string containing Python code.
    """
    lines: List[str] = []
    lines.append("import tkinter as tk")
    lines.append("")
    lines.append("root = tk.Tk()")
    lines.append("root.title('Generated GUI')")
    # Optionally set a minimum window size based on widget extents
    max_right = max(w.x + w.width for w in layout.widgets) if layout.widgets else 0
    max_bottom = max(w.y + w.height for w in layout.widgets) if layout.widgets else 0
    lines.append(f"root.geometry('{max_right}x{max_bottom}')")
    lines.append("")

    # Create widgets
    for widget in layout.widgets:
        var_name = widget.id
        wtype = widget.type
        # Determine constructor and options
        constructor = f"tk.{wtype}"
        options: List[str] = []
        if widget.text is not None and wtype in {"Button", "Label", "Entry"}:
            # For Entry, text maps to default insertion.
            if wtype == "Entry":
                options.append("root")
            else:
                options.append("root")
                options.append(f"text={widget.text!r}")
        else:
            options.append("root")
        # Join options
        opts = ", ".join(options)
        lines.append(f"{var_name} = {constructor}({opts})")
        # Insert text into Entry if provided
        if wtype == "Entry" and widget.text is not None:
            lines.append(f"{var_name}.insert(0, {widget.text!r})")
        # Place the widget
        lines.append(
            f"{var_name}.place(x={widget.x}, y={widget.y}, width={widget.width}, height={widget.height})"
        )
        lines.append("")

    lines.append("root.mainloop()")
    return "\n".join(lines)


app = FastAPI()

# Allow cross‑origin requests from the frontend running on any host.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.post("/generate_code")
async def generate_code(layout: Layout) -> Dict[str, str]:
    """API endpoint to generate Python code for a given layout.

    Returns a JSON object containing the code as a string.
    """
    try:
        code = generate_tkinter_code(layout)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"code": code}