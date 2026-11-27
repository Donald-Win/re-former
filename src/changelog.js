// ── Changelog ────────────────────────────────────────────────────────────────
// Each entry in CHANGELOGS is a batch with a unique version key.
// Users see ALL batches they haven't dismissed yet.
//
// To announce an update:
//   1. Add a NEW object to the TOP of the CHANGELOGS array
//   2. Give it a unique `version` string
//   3. Fill in the `changes` array
//   4. Deploy
//
// To deploy silently: don't touch this file.

export const CHANGELOGS = [
  {
    version: '2.36.0',
    changes: [
      {
        heading: 'New form: Conductor Tension Method & Results Per Run',
        detail: '360S014EQ is now available under Browse All Forms and Conductor Tension Works.',
      },
    ],
  },
  {
    version: '2.35.0',
    changes: [
      {
        heading: 'New form: Cable Test Report',
        detail: '360S014EL is now available. Includes a schematic drawn with the plan editor.',
      },
      {
        heading: 'Saved test sets in My Details',
        detail: 'Save up to three named test sets (make, model, serial) and pick one on the Cable Test Report.',
      },
    ],
  },
  {
    version: '2.34.0',
    changes: [
      {
        heading: 'Clearer error messages',
        detail: 'Errors now say which step failed and why. Use Copy diagnostics on any error screen to share them.',
      },
      {
        heading: 'Blank forms explain failures',
        detail: 'If a blank form won\'t open, the viewer shows the reason with Try again and Open in new tab.',
      },
      {
        heading: 'Error screens no longer go blank',
        detail: 'Unexpected errors show a message and a Reload app button. Drafts and My Details are kept.',
      },
    ],
  },
  {
    version: '2.33.0',
    changes: [
      {
        heading: 'New form: Streetlight Alteration/Installation Record',
        detail: '360S014EK is now available, with a dimensioned plan.',
      },
    ],
  },
  {
    version: '2.32.1',
    changes: [
      {
        heading: 'Hidden sections no longer print',
        detail: 'Details from a section you have since hidden are left off the printed form.',
      },
      {
        heading: 'Panel layout fixes',
        detail: 'Changing a fuse carrier keeps the row details. Long Pole Record work descriptions wrap.',
      },
      {
        heading: 'Draft and share fixes',
        detail: 'Loading a draft replaces photos properly. A failed share no longer clears your work.',
      },
      {
        heading: 'Plan and photo fixes',
        detail: 'Drawn circles print at the on-screen size. Unreadable photos are flagged. GPS height is labelled correctly.',
      },
    ],
  },
  {
    version: '2.32.0',
    changes: [
      {
        heading: 'New form: Underground Panel Layout Record',
        detail: '360S014EI is now available, with fuse-row entry for up to 16 rows.',
      },
    ],
  },
  {
    version: '2.31.0',
    changes: [
      {
        heading: 'Line ends',
        detail: 'Lines can finish with an arrow, dot or bar at either or both ends.',
      },
    ],
  },
  {
    version: '2.30.0',
    changes: [
      {
        heading: 'LV Connection Record: dimensioned plan',
        detail: 'Draw the conductor route on screen. Plans can be saved as templates.',
      },
    ],
  },
  {
    version: '2.29.0',
    changes: [
      {
        heading: 'Electrical Distribution Record: dimensioned plan',
        detail: 'Draw the cable route on screen. Plans can be saved as templates.',
      },
    ],
  },
  {
    version: '2.28.1',
    changes: [
      {
        heading: 'Larger shapes',
        detail: 'Rectangles and circles can be resized up to the full plan box.',
      },
    ],
  },
  {
    version: '2.28.0',
    changes: [
      {
        heading: 'Pole Record: Work Plan',
        detail: 'Draw the job on the form\'s work plan box, with a template option.',
      },
    ],
  },
  {
    version: '2.27.1',
    changes: [
      {
        heading: 'Templates no longer keep north',
        detail: 'Loading a template leaves north unset, so you set it for each drawing.',
      },
    ],
  },
  {
    version: '2.27.0',
    changes: [
      {
        heading: 'Plan templates',
        detail: 'Save a drawing under a name and load it later. Templates are per form and included in Backup & Restore.',
      },
    ],
  },
  {
    version: '2.26.0',
    changes: [
      {
        heading: 'Earth plan drawn in the app',
        detail: 'Build the earth plan on screen with shapes, lines, dimensions and text. Pinch to zoom.',
      },
    ],
  },
  {
    version: '2.25.0',
    changes: [
      {
        heading: 'New form: Earth Installation and Test Record',
        detail: '360S014EJ is now available. The plan is still drawn by hand on the printed form.',
      },
    ],
  },
  {
    version: '2.24.0',
    changes: [
      {
        heading: 'Reorder photos',
        detail: 'Move photos earlier or later before printing.',
      },
    ],
  },
  {
    version: '2.23.0',
    changes: [
      {
        heading: 'Backup & Restore',
        detail: 'Back up drafts, projects and My Details to one file, and restore it on a new device.',
      },
      {
        heading: 'Pole Record: "Other" pole type',
        detail: 'The "Other" pole type is selectable, and the text you enter prints on the form.',
      },
    ],
  },
  {
    version: '2.22.1',
    changes: [
      {
        heading: 'Macrons work everywhere',
        detail: 'Māngere, Ōtāhuhu and other macron names now print in every form.',
      },
    ],
  },
  {
    version: '2.22.0',
    changes: [
      {
        heading: 'Optional Map Number',
        detail: 'A Map Number field is on every job details step.',
      },
    ],
  },
  {
    version: '2.21.0',
    changes: [
      {
        heading: 'Fewer "What\'s New" prompts',
        detail: 'Devices with cleared storage no longer see the full history. Skip all is available when several updates are waiting.',
      },
    ],
  },
  {
    version: '2.20.6',
    changes: [
      {
        heading: 'Faster PDFs with photos',
        detail: 'Photos are no longer reprocessed when a PDF is generated, so forms with several photos finish sooner.',
      },
    ],
  },
  {
    version: '2.20.5',
    changes: [
      {
        heading: 'Sharper photos in PDFs',
        detail: 'Photos keep more of their original quality.',
      },
    ],
  },
  {
    version: '2.20.4',
    changes: [
      {
        heading: 'Completed forms clear correctly',
        detail: 'A shared or printed form no longer shows "unsaved progress" when reopened.',
      },
      {
        heading: 'HV Inspection fixes',
        detail: 'Performance tick placement is corrected, and restoring progress returns you to the right step.',
      },
    ],
  },
  {
    version: '2.20.3',
    changes: [
      {
        heading: 'Smaller, faster drafts',
        detail: 'Photos are resized when attached, so drafts save faster and take less space.',
      },
      {
        heading: 'Smoother typing',
        detail: 'Long text fields no longer stutter on older tablets.',
      },
      {
        heading: 'PDF generation recovers',
        detail: 'After a failure, Retry works without reloading the app.',
      },
    ],
  },
  {
    version: '2.20.2',
    changes: [
      {
        heading: 'Pole Record rows fixed',
        detail: 'A new conductor row no longer disappears after you tap Cu, Ali or Manual.',
      },
      {
        heading: 'Update banner reloads once',
        detail: 'Tapping Update now refreshes the app once, not twice.',
      },
    ],
  },
  {
    version: '2.20.1',
    changes: [
      {
        heading: 'Restoring progress from Preview',
        detail: 'Restoring from the Preview screen returns you to Photos, so you can tap Preview Form again.',
      },
    ],
  },
  {
    version: '2.20.0',
    changes: [
      {
        heading: 'Pick up where you left off',
        detail: 'If the app closes partway through a form, reopening it offers to restore your progress, including photos.',
      },
      {
        heading: 'HV signatures kept in drafts',
        detail: 'Team Lead and Field Switcher signatures are saved and restored.',
      },
    ],
  },
  {
    version: '2.19.1',
    changes: [
      {
        heading: 'Distribution Transformer label',
        detail: 'The missing-fields warning now says "PCo W/O No.".',
      },
    ],
  },
  {
    version: '2.19.0',
    changes: [
      {
        heading: 'PDFs no longer freeze the app',
        detail: 'PDF generation runs in the background, so the screen stays responsive.',
      },
    ],
  },
  {
    version: '2.18.3',
    changes: [
      {
        heading: 'Photos stay in order',
        detail: 'Photos appear in the PDF in the order you selected them.',
      },
    ],
  },
  {
    version: '2.18.2',
    changes: [
      {
        heading: 'GPS fewer timeouts',
        detail: 'GPS buttons accept a location from the last 30 seconds, so weak-signal areas time out less.',
      },
    ],
  },
  {
    version: '2.18.1',
    changes: [
      {
        heading: 'All photos kept in drafts',
        detail: 'Drafts keep every photo, not just the first five.',
      },
      {
        heading: 'Loading a draft replaces photos',
        detail: 'Loading a draft always shows exactly the photos saved with it.',
      },
      {
        heading: 'Earth tick at the limit',
        detail: 'An exact 25 Ω reading on the Distribution Transformer certificate now ticks.',
      },
    ],
  },
  {
    version: '2.18.0',
    changes: [
      {
        heading: 'GPS for Pole Record co-ordinates',
        detail: 'Use my GPS fills in North, East and Altitude.',
      },
    ],
  },
  {
    version: '2.17.0',
    changes: [
      {
        heading: 'Add Row stays visible',
        detail: 'Add Row no longer disappears after you delete every row.',
      },
      {
        heading: 'Save Draft resets',
        detail: 'Save Draft no longer gets stuck on "Saving…".',
      },
      {
        heading: 'All photos saved in drafts',
        detail: 'Drafts and autosaves keep every attached photo.',
      },
    ],
  },
  {
    version: '2.16.0',
    changes: [
      {
        heading: 'Full changelog',
        detail: 'Tap the version number to see every update.',
      },
    ],
  },
  {
    version: '2.15.0',
    changes: [
      {
        heading: 'Collapsible Browse All Forms',
        detail: 'Categories start closed. Searching opens any with matches.',
      },
    ],
  },
  {
    version: '2.14.0',
    changes: [
      {
        heading: 'Signature shows in My Details',
        detail: 'Your saved signature displays when you open My Details.',
      },
      {
        heading: 'Default view',
        detail: 'Choose whether the app opens on By Work Type or Browse All Forms.',
      },
    ],
  },
  {
    version: '2.13.0',
    changes: [
      {
        heading: 'Offline support',
        detail: 'Forms, drafts and previews work offline. An offline bar shows when the connection drops.',
      },
      {
        heading: 'Updates need your say-so',
        detail: 'A new version installs only when you tap Update now.',
      },
      {
        heading: 'Drafts stored safely',
        detail: 'Drafts and photos are kept in IndexedDB, so they are not lost when storage is tight.',
      },
      {
        heading: 'Numeric keypad on number fields',
        detail: 'Number fields open the number pad on iOS and Android.',
      },
      {
        heading: 'Smoother previews and faster start',
        detail: 'Previews keep a steady scroll position, and the app loads in smaller pieces.',
      },
      {
        heading: 'No accidental zoom',
        detail: 'Pinch-to-zoom is disabled on field devices.',
      },
    ],
  },
  {
    version: '2.12.0',
    changes: [
      {
        heading: 'User Settings',
        detail: 'Your name, contractor, cert number and signature are saved once and filled in automatically.',
      },
      {
        heading: 'Projects and named drafts',
        detail: 'Save job details as a project, and save named drafts to load later.',
      },
      {
        heading: 'HV Inspection Certificate (220F028A)',
        detail: 'New wizard with a Tick All button per section.',
      },
      {
        heading: 'Save Draft in every step',
        detail: 'The Save Draft button is in the nav bar on every step.',
      },
    ],
  },
  {
    version: '2.11.0',
    changes: [
      {
        heading: 'Save for later',
        detail: 'Save progress and close a form mid-fill. Reopening it offers to continue.',
      },
      {
        heading: 'Smarter file names',
        detail: 'PDFs are named using the site ID, such as the old pole ID or ICP number.',
      },
      {
        heading: 'Smaller PDFs',
        detail: 'Photos are compressed further, so a typical four-photo PDF is much smaller.',
      },
    ],
  },
  {
    version: '2.10.0',
    changes: [
      {
        heading: 'Use my location',
        detail: 'Fills in street address, city and district from GPS.',
      },
      {
        heading: 'Remembered details',
        detail: 'Contractor, name and signature are pre-filled. Date Work Completed defaults to today.',
      },
      {
        heading: 'Conductor quick-pick',
        detail: 'Choose Cu or Ali for common sizes, or enter manually.',
      },
    ],
  },
  {
    version: '2.9.0',
    changes: [
      {
        heading: 'Photo attachments',
        detail: 'Every wizard has a Photos step. Each photo prints on its own page.',
      },
      {
        heading: 'Dropdowns on the Pole Record',
        detail: 'Conductor and crossarm fields are dropdowns.',
      },
    ],
  },
  {
    version: '2.8.0',
    changes: [
      {
        heading: 'Smart file names',
        detail: 'PDFs are named with the project name and NP job number.',
      },
      {
        heading: 'Draft autosave',
        detail: 'If a wizard closes mid-fill, a Restore draft banner appears on reopen.',
      },
      {
        heading: 'Update notices',
        detail: 'A summary of changes appears after each update.',
      },
    ],
  },
]