# ZEBJUS Python Lab v5.14 — Exact Error Line Test

## Test 1 — Blank lines + NameError

Paste this exactly:

```python





















print(student_value)
```

The `print(student_value)` line should be highlighted at its actual editor line.

Expected:
- `NameError`
- Terminal reports the actual failing line
- red `●` appears beside that same line
- not line 1

## Test 2 — TypeError

```python
x = 10



name = "Age"




print(name + x)
```

The red marker must appear on the `print(name + x)` line.

## Test 3 — SyntaxError

```python
x = 10



if x > 5
    print(x)
```

The syntax marker must appear on the `if x > 5` line.

## Example projects

There are no separate `.py` project files.

Use:

```text
Example dropdown → select Project 01–20
```

The selected code loads directly into the editor.
