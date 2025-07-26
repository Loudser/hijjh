/*
 * Frontend logic for the Tkinter GUI Builder.
 *
 * This file implements a minimal drag‑and‑drop editor using plain
 * JavaScript. The user can drag widget types from the sidebar onto the
 * canvas; select widgets to edit their properties; and export the layout
 * to Python code via the backend API. The code intentionally avoids
 * external dependencies so it can run in constrained environments.
 */

// State
let widgets = []; // list of widget objects
let selectedWidgetId = null;
let idCounter = 1;

function generateId(prefix) {
  return `${prefix}${idCounter++}`;
}

// Initialise after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  const exportBtn = document.getElementById('exportBtn');
  const inspectorContent = document.getElementById('inspector-content');

  // Setup drag source for widget items
  document.querySelectorAll('.widget-item').forEach((item) => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', item.dataset.type);
    });
  });

  // Canvas dragover and drop
  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plain');
    if (!type) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    addWidget(type, x, y);
  });

  // Export button handler
  exportBtn.addEventListener('click', async () => {
    if (widgets.length === 0) {
      alert('Add some widgets before exporting.');
      return;
    }
    try {
      const response = await fetch('http://localhost:8000/generate_code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ widgets }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to generate code');
      }
      const data = await response.json();
      downloadCode(data.code);
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    }
  });

  // Add a widget to the state and re-render
  function addWidget(type, x, y) {
    const id = generateId('w');
    // Default sizes vary by type
    let width = 100;
    let height = 30;
    if (type === 'Frame') {
      width = 150;
      height = 100;
    } else if (type === 'Menu') {
      width = 120;
      height = 30;
    }
    const widget = {
      id,
      type,
      x,
      y,
      width,
      height,
      text: type,
    };
    widgets.push(widget);
    selectWidget(id);
    render();
  }

  // Render the canvas based on the widgets array
  function render() {
    // Clear existing widgets from the canvas
    canvas.innerHTML = '';
    widgets.forEach((widget) => {
      const el = document.createElement('div');
      el.classList.add('widget');
      el.style.left = widget.x + 'px';
      el.style.top = widget.y + 'px';
      el.style.width = widget.width + 'px';
      el.style.height = widget.height + 'px';
      el.textContent = widget.text || widget.type;
      el.dataset.id = widget.id;
      if (widget.id === selectedWidgetId) {
        el.classList.add('selected');
      }
      // Click handler for selection
      el.addEventListener('mousedown', (e) => {
        // Prevent dragging default from sidebar
        e.stopPropagation();
        selectWidget(widget.id);
        // Start dragging inside canvas
        startDrag(widget, e);
      });
      canvas.appendChild(el);
    });
  }

  function selectWidget(id) {
    selectedWidgetId = id;
    renderInspector();
    render();
  }

  function renderInspector() {
    const widget = widgets.find((w) => w.id === selectedWidgetId);
    if (!widget) {
      inspectorContent.textContent = 'Select a widget to edit its properties.';
      return;
    }
    // Build a form to edit properties
    inspectorContent.innerHTML = '';
    const form = document.createElement('div');
    // Type (read-only)
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Type';
    const typeInput = document.createElement('input');
    typeInput.value = widget.type;
    typeInput.disabled = true;
    form.appendChild(typeLabel);
    form.appendChild(typeInput);
    // Text
    if (widget.type !== 'Frame') {
      const textLabel = document.createElement('label');
      textLabel.textContent = 'Text';
      const textInput = document.createElement('input');
      textInput.value = widget.text;
      textInput.addEventListener('input', () => {
        widget.text = textInput.value;
        render();
      });
      form.appendChild(textLabel);
      form.appendChild(textInput);
    }
    // Geometry properties: x, y, width, height
    ['x', 'y', 'width', 'height'].forEach((prop) => {
      const label = document.createElement('label');
      label.textContent = prop.toUpperCase();
      const input = document.createElement('input');
      input.type = 'number';
      input.value = widget[prop];
      input.addEventListener('input', () => {
        widget[prop] = parseInt(input.value, 10) || 0;
        render();
      });
      form.appendChild(label);
      form.appendChild(input);
    });
    inspectorContent.appendChild(form);
  }

  // Dragging logic for widgets on the canvas
  function startDrag(widget, mouseDownEvent) {
    const offsetX = mouseDownEvent.offsetX;
    const offsetY = mouseDownEvent.offsetY;
    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      widget.x = Math.round(e.clientX - rect.left - offsetX);
      widget.y = Math.round(e.clientY - rect.top - offsetY);
      render();
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // Create a downloadable file from code and prompt the user
  function downloadCode(code) {
    const blob = new Blob([code], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'generated_gui.py';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
});