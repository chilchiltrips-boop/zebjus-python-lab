# ZEBJUS Python Lab v5.10 — Editor Error + Autocomplete Test

## 1. SyntaxError marker

Type:

```python
x = 10

if x > 5
    print(x)
```

Expected after a short pause:
- red dot beside line 3
- red underline/highlight
- `SyntaxError`
- suggestion to add `:`

Run should not start until the syntax error is fixed.

## 2. NameError

Type:

```python
student_name = "Binu"
print(studnt_name)
```

Run.

Expected:
- `NameError` with the failing line highlighted
- suggestion similar to `Did you mean 'student_name'?`

## 3. TypeError

Type:

```python
age = 10
print("Age: " + age)
```

Run.

Expected:
- `TypeError`
- failing line highlighted
- suggestion to convert values using `str()`, `int()`, or `float()`

## 4. Dynamic variables

Type:

```python
distance = 45
student_name = "Asha"
motor_speed = 60

def calculate_speed():
    return motor_speed
```

Then on a new line type:

```text
dis
```

Suggestions should include `distance`.

Type:

```text
stu
```

Suggestions should include `student_name`.

Type:

```text
cal
```

Suggestions should include `calculate_speed`.
