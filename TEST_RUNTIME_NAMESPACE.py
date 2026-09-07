from pathlib import Path

ROOT=Path(__file__).resolve().parent
worker=(ROOT/'py-worker.js').read_text()
required=(
    'def _zebjus_new_student_namespace():',
    '_zebjus_student_globals=_zebjus_new_student_namespace()',
    'def _zebjus_reset_student_namespace():',
    'def _zebjus_ensure_terminal_streams():',
    'exec(compile(str(__student_exec_code), "main.py", "exec"), _zebjus_student_globals, _zebjus_student_globals)',
    '_zebjus_reset_student_namespace();_i2c_bus_claimed={};_gps_state={}',
)
for marker in required:
    if marker not in worker:
        raise SystemExit('Missing protected-runtime marker: '+marker)
if 'exec(compile(str(__student_exec_code), "main.py", "exec"), globals(), globals())' in worker:
    raise SystemExit('Student code still executes in runtime globals')

# Semantic regression: user globals may use common/private-looking names without
# changing the host/runtime namespace, and state persists until a session reset.
runtime={'io':'runtime-io','json':'runtime-json','time':'runtime-time','math':'runtime-math','_zebjus_stdout':'runtime-stream'}
def new_student_namespace():
    return {'__name__':'__main__','__file__':'main.py','__package__':None,'__builtins__':__builtins__}
student=new_student_namespace()
exec(compile('io=1\njson=2\ntime=3\nmath=4\n_zebjus_stdout=None\ncounter=7', 'main.py','exec'), student, student)
assert runtime=={'io':'runtime-io','json':'runtime-json','time':'runtime-time','math':'runtime-math','_zebjus_stdout':'runtime-stream'}
exec(compile('counter += 1', 'main.py','exec'), student, student)
assert student['counter']==8
student=new_student_namespace()
assert 'counter' not in student and 'io' not in student and '_zebjus_stdout' not in student
print('Protected runtime namespace regression PASS')
