# opencodex-dev-build

Daily automated build of the **`dev`** branch of
[lidge-jun/opencodex](https://github.com/lidge-jun/opencodex), packaged as a
GitHub Release you can install instead of the stable npm release.

The workflow runs every day at 04:00 UTC (and manually from the Actions tab).
It checks out `dev`, builds the package + GUI, packs a tarball, and uploads it
as a release tagged like `dev-YYYYMMDD-<shorthash>`. Days where `dev` didn't
move are skipped.

## Install the latest dev build

From PowerShell:

```powershell
# optional: remove the stable release first
npm uninstall -g @bitkyc08/opencodex

npm install -g --force https://github.com/sushmitxo/opencodex-dev-build/releases/latest/download/opencodex-dev.tgz
```

Re-run that install command any time you want the newest dev build.

> ⚠️ Don't run `ocx update` on this build — the built-in updater replaces the
> dev package with the registry's `latest`/`preview` release. Refresh via the
> GitHub Release URL instead.

## Trigger a build now

<https://github.com/sushmitxo/opencodex-dev-build/actions> → select **Build dev
release** → **Run workflow**.

## Releases

https://github.com/sushmitxo/opencodex-dev-build/releases