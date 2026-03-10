// ── Changelog ────────────────────────────────────────────────────────────────
// To show a notice to users:
//   1. Update CHANGELOG_VERSION to any new string (e.g. '2.7.0' or 'dec-update')
//   2. Update the changes array below
//   3. Deploy — users will see the modal once, then never again until you change the version
//
// To deploy a silent update (no notice):
//   Just leave this file as-is.

export const CHANGELOG_VERSION = '1'

export const CHANGELOG = [
  {
    heading: 'Fixed Bug on iOS',
    detail: 'Saving file to iPad was resulting in unwanted sidecar download of txr file. Changed dowload handler to fix'
  },
  {
    heading: 'Added update message screen',
    detail: 'Its what you are reading now'
  },
]
