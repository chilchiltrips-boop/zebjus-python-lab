# ZEBJUS Python Lab v5.24 — Gradient Grid Dark IDE Layout Test

## Desktop target

1. Project controls remain compact at the top.
2. Main workspace uses a coding-first split:
   - `main.py` editor: roughly 80%+ of available width.
   - Right utility column: Camera / MediaPipe → Serial Plotter → Image Upload.
3. Next row uses two columns:
   - Kit Output / Sensors.
   - OpenCV / imshow Output.
4. Output / Terminal is full width below that row.
5. Quick Tools / Project Reference is the final compact row.

## Visual target

- Dark neutral editor surface for long coding sessions.
- Subtle blue/cyan/violet gradient accents on panels and controls only.
- Compact panel titles, buttons, paddings, scrollbars and sensor cards.
- Main editor uses viewport height on desktop and remains the visual priority.
- No bright gradient behind source code.

## Responsive target

- <= 980 px: editor first, utility tools form a row when space permits.
- <= 720 px: Camera, Plotter and Upload stack vertically.
- Kit Output and imshow stack on smaller screens.
- Mobile editor keeps a practical fixed working height and 16 px minimum font for readability.
