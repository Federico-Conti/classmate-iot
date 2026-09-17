# Local Secrets

Keep runtime credentials in this directory using the extensionless filenames described by the templates. Git ignores every file here except this README and `*.example` templates.

Use restrictive permissions before creating local values:

```sh
umask 077
```

Do not commit passwords, tokens, private keys, or generated Mosquitto password files.
