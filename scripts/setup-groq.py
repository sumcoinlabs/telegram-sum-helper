#!/usr/bin/env python3
"""Private interactive Groq setup. Tests permissions before touching the existing .env."""
import getpass
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / '.env'
API = 'https://api.groq.com/openai/v1'
MODELS = ('openai/gpt-oss-120b', 'openai/gpt-oss-20b')


def error_detail(exc, secret):
    """Report only safe Groq error fields; never echo credentials or raw bodies."""
    status = getattr(exc, 'code', '?')
    try:
        result = json.loads(exc.read(8192))
        err = result.get('error', {})
        if not isinstance(err, dict):
            err = {}
    except (ValueError, OSError, AttributeError):
        err = {}
    code = str(err.get('code') or '').replace(secret, '[redacted]')[:90]
    kind = str(err.get('type') or '').replace(secret, '[redacted]')[:90]
    msg = str(err.get('message') or '').replace(secret, '[redacted]')
    msg = re.sub(r'gsk_[A-Za-z0-9_-]+', '[redacted]', msg)[:350]
    print(f'  HTTP {status} | type: {kind or "not provided"} | code: {code or "not provided"}')
    if msg:
        print(f'  Detail: {msg}')
    if status == 403:
        print('  Check Groq organization/project model permissions and account restrictions.')
        print('  https://console.groq.com/settings/limits')
        print('  https://console.groq.com/settings/project/limits')
    elif status == 401:
        print('  The key was not accepted. Check the Groq project/API key and try again.')
    elif status == 429:
        print('  Groq rate limit reached. Wait for the free allowance to reset.')


def call(path, secret, data=None):
    headers = {'Authorization': 'Bearer ' + secret, 'Accept': 'application/json',
               'User-Agent': 'SumcoinHelper/0.0.18'}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(API + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers=headers, method='POST' if data is not None else 'GET')
    with urllib.request.urlopen(req, timeout=35) as res:
        return json.load(res)


def main():
    if not ENV.is_file():
        raise SystemExit('ERROR: Existing private .env not found; nothing changed.')
    secret = getpass.getpass('Groq API key (hidden; not logged): ').strip()
    if not re.fullmatch(r'[A-Za-z0-9_-]{20,200}', secret):
        raise SystemExit('ERROR: Key format invalid; nothing changed.')

    print('\n========== VERIFY GROQ ACCOUNT ==========')
    try:
        available = call('/models', secret)
        visible = {x.get('id') for x in available.get('data', []) if isinstance(x, dict)}
        print('Model listing accessible.')
        for model in MODELS:
            print(f'  {model}: {"listed" if model in visible else "not listed"}')
    except urllib.error.HTTPError as exc:
        error_detail(exc, secret)
        if exc.code in (401, 403):
            raise SystemExit('Groq account verification failed. Nothing was changed.')
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        print(f'Model listing unavailable ({type(exc).__name__}); checking model calls directly.')

    print('\n========== VERIFY GROQ INFERENCE ==========')
    selected = None
    for model in MODELS:
        print(f'Testing {model} ...')
        payload = {'model': model, 'input': 'Reply with the single word READY.',
                   'max_output_tokens': 500, 'reasoning': {'effort': 'low'}}
        try:
            response = call('/responses', secret, payload)
            replies = [str(part.get('text', '')).strip()
                       for item in response.get('output', []) if isinstance(item, dict)
                       for part in item.get('content', []) if isinstance(part, dict)
                       and part.get('type') == 'output_text']
            if not any(replies):
                print('  No text output; not enabling this model.')
                continue
            selected = model
            print('  SUCCESS: Groq responded.')
            break
        except urllib.error.HTTPError as exc:
            error_detail(exc, secret)
            if exc.code in (401, 429):
                break
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
            print(f'  Connection failed ({type(exc).__name__}); no configuration changed.')
            break
    if selected is None:
        raise SystemExit('\nNo permitted model responded. Groq remains disabled; your bot is unaffected.')

    updates = {
        'AI_ENABLED': 'true', 'AI_PROVIDER': 'groq', 'AI_MODEL': selected,
        'GROQ_API_KEY': secret, 'AI_HOURLY_LIMIT': '4', 'AI_DAILY_LIMIT': '12',
        'AI_MONTHLY_LIMIT': '60', 'AUTO_AI': 'false',
    }
    lines = ENV.read_text(encoding='utf-8').splitlines()
    for k, v in updates.items():
        match = re.compile(r'^\s*' + re.escape(k) + r'\s*=')
        lines = [line for line in lines if not match.match(line)]
        lines.append(f'{k}={v}')
    temporary = ROOT / f'.env.{os.getpid()}.new'
    try:
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as output:
            output.write('\n'.join(lines) + '\n')
        os.replace(temporary, ENV)
        ENV.chmod(0o600)
    finally:
        if temporary.exists():
            temporary.unlink()
    print(f'\nEnabled Groq using {selected} with 4/hour, 12/day, 60/month limits.')
    print('Private .env updated. No key or chat transcript was printed or committed.')
    print('Restart telegram-sum-helper.service to activate. Plain offline fallback remains available.')


if __name__ == '__main__':
    main()
