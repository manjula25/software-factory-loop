# Non-GitHub source fixture (WI-3 T6, step 3)

## titlecase returns ALL CAPS instead of Title Case

`titlecase("hello world")` returns `'HELLO WORLD'` instead of `'Hello World'`.
Expected: the first letter of each word capitalized, everything else left as it
was (e.g. `titlecase("pyTest suite")` → `'PyTest Suite'`, not `'PYTEST SUITE'`).

log: https://github.com/user-attachments/files/32143084/loopfix-issue3-session.log
