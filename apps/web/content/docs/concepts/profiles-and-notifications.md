---
title: Profiles, follows and notifications
description: What a profile shows, who can see your follows, what sends you a notification and how long it is kept.
order: 7
---

Every account has a profile at `/u/<username>`. You can follow the people whose designs you want
to hear about, and the bell in the top bar tells you when something happens to your work or
theirs.

## Profiles

A profile shows the avatar, name, `@username`, bio and the month the account joined, then four
numbers:

- **Designs** — public designs with a release. Private designs and designs that were never
  published are not counted and not listed.
- **Clones** — how many times those public designs have been cloned, added up.
- **Followers** and **Following** — each links to the list of accounts.

Below the numbers are the public designs, newest release first. On your own profile you also see
how many private or unpublished drafts you have, and a folded **Your drafts** section listing
them. Nobody else sees either.

A closed account has no profile: its address answers 404.

## Follows

Follow someone from their profile. Following is one click and undoing it is another; neither
tells the other person anything except through their follower count.

> [!NOTE]
> Follower and following lists are **public**, as they are on GitHub. Anyone, signed in or not,
> can see who follows an account and whom it follows.

You cannot follow yourself. Following needs a session, and an account can change its follows at
most 60 times an hour, which is plenty for a person and not enough for a follow-everyone script.

## Notifications

The bell in the top bar appears when you are signed in. Its badge counts what you have not read
yet, and it checks for new ones once a minute while the tab is open and visible — there is no live
connection. Opening the panel shows the latest ten and marks the ones on screen read after two
seconds; **Mark all read** clears the rest. `/notifications` has the full list, with an unread
filter.

What sends you a notification:

| Event | You are told when |
|---|---|
| **Cloned** | someone else clones one of your public designs. Cloning your own design is silent. |
| **Published** | someone you follow publishes a public design: a first release, a new release, or a released design made public. At most one per design every 24 hours, so a burst of releases is one notice. |

A private design never notifies anyone, and nothing is sent to a closed account. Findings are
worked out when a design is read, not stored, so a catalogue or rule change does not produce a
notification; that kind is reserved for a later phase.

If the account that acted has since been closed, the notification stays but no longer names it.
If the design has been deleted or made private, the notification stays without the link.

## Retention

Notifications are kept for **90 days**. Older ones are deleted the next time you open your list,
read or unread.
