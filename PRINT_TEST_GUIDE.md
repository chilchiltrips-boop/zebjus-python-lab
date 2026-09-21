# ZEBJUS Python Lab v5.7 — print() Test

Paste this into the editor:

```python
print("Start")

x = 10
y = 20
print("x =", x)
print("y =", y)
print("Total =", x + y)

if x < y:
    print("x is smaller")

for i in range(3):
    print("Loop", i)

print("A", end=" | ")
print("B")

def test():
    print("Inside function")

test()
print("Finished")
```

Expected Terminal:

```text
Start
x = 10
y = 20
Total = 30
x is smaller
Loop 0
Loop 1
Loop 2
A | B
Inside function
Finished
```

The output should appear in the Terminal while the program executes.
