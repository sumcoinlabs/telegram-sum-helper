#!/usr/bin/env python3
"""Private, read-only Telegram Desktop export audit (not a member enumeration tool).

The bot stores anonymized historical QUESTION patterns. This script intentionally
runs locally; without --private-csv it reports only aggregate numbers. It cannot
establish whether a historical sender is currently in the group or contact them.
"""
import argparse
import collections
import csv
import json
import os
import pathlib
import sys
import zipfile


def load(path):
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            files = [name for name in archive.namelist() if name.endswith('result.json') and not name.startswith('__MACOSX/')]
            if len(files) != 1:
                raise ValueError('Expected one Telegram Desktop result.json in ZIP')
            with archive.open(files[0]) as stream:
                return json.load(stream)
    with open(path, encoding='utf-8') as stream:
        return json.load(stream)


def analyze(data):
    messages = data.get('messages')
    if not isinstance(messages, list):
        raise ValueError('Not a Telegram Desktop group export')
    authors = {}
    actors = set()
    actions = collections.Counter()
    added_names = set()
    removed_names = set()
    for entry in messages:
        if not isinstance(entry, dict):
            continue
        action = entry.get('action')
        if isinstance(action, str):
            actions[action] += 1
        if entry.get('type') == 'message' and isinstance(entry.get('from_id'), str):
            user_id = entry['from_id']
            if not user_id.startswith('user'):
                continue
            existing = authors.setdefault(user_id, {'identifier': user_id, 'display_name': '', 'messages': 0, 'last_post': ''})
            existing['messages'] += 1
            if entry.get('date', '') >= existing['last_post']:
                existing['last_post'] = entry.get('date', '')
                existing['display_name'] = entry.get('from') if isinstance(entry.get('from'), str) else ''
        if isinstance(entry.get('actor_id'), str) and entry['actor_id'].startswith('user'):
            actors.add(entry['actor_id'])
        if action in ('invite_members', 'remove_members'):
            target = added_names if action == 'invite_members' else removed_names
            for name in entry.get('members') or []:
                if isinstance(name, str) and name.strip():
                    target.add(name.strip())
    return messages, authors, actors, actions, added_names, removed_names


def main():
    parser = argparse.ArgumentParser(description='Audit your own Telegram Desktop group export offline; no network calls.')
    parser.add_argument('export', type=pathlib.Path, help='result.json or its ZIP from Telegram Desktop')
    parser.add_argument('--private-csv', type=pathlib.Path, help='Optional private CSV of historical message authors; NOT a list of former members')
    args = parser.parse_args()
    data = load(args.export)
    msgs, authors, actors, actions, added_names, removed_names = analyze(data)
    print('Telegram Desktop export:', data.get('name', 'group'))
    print('Messages and service events:', len(msgs))
    print('Unique message author IDs:', len(authors))
    print('Unique actor IDs in service events:', len(actors))
    print('Recorded member invite/add events:', actions['invite_members'])
    print('Recorded link-join events:', actions['join_group_by_link'])
    print('Recorded remove-member events:', actions['remove_members'])
    print('Distinct visible invited-member labels:', len(added_names))
    print('Distinct visible removed-member labels:', len(removed_names))
    print('IMPORTANT: The export has no complete current/former member roster. Names are not unique; missing events are possible.')
    print('Bot API cannot add arbitrary users or DM people who never started the bot. Do not bulk re-add people.')
    if args.private_csv:
        path = args.private_csv.expanduser().resolve()
        if path.exists():
            raise SystemExit('Refusing to overwrite an existing private report')
        fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=['identifier','display_name','messages','last_post'])
            writer.writeheader()
            for row in sorted(authors.values(), key=lambda a:a['last_post'], reverse=True):
                writer.writerow(row)
        print('Private author activity CSV created:', path)
        print('This is NOT a verified former-member list. Keep it local and never commit it to GitHub.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        sys.exit(f'Export audit failed: {type(exc).__name__}: {exc}')
