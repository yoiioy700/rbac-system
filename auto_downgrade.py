import os
import re
import sys
import json
import urllib.request
import subprocess

def check_rust_version(rv):
    if not rv: return True
    parts = rv.split('-')[0].split('.')
    if len(parts) >= 2:
        try:
            return int(parts[0]) == 1 and int(parts[1]) <= 75
        except:
            pass
    return False

def downgrade_crate(spec, skip_versions=None):
    if skip_versions is None: skip_versions = []
    crate = spec.split('@')[0] if '@' in spec else spec
    print(f"Fetching versions for {crate} from crates.io API...")
    url = f'https://crates.io/api/v1/crates/{crate}/versions'
    req = urllib.request.Request(url, headers={'User-Agent': 'cargo-downgrader/1.0'})
    selected_version = None
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read())
            for v in data['versions']:
                if v['yanked']: continue
                if v['num'] in skip_versions: continue
                if check_rust_version(v.get('rust_version')):
                    selected_version = v['num']
                    break
        if selected_version:
            print(f"Downgrading {spec} to {selected_version}...")
            subprocess.run(['cargo', 'update', '-p', spec, '--precise', selected_version])
            return selected_version
        else:
            print(f"No suitable version found for {crate}.")
            return None
    except Exception as e:
        print(f"API request failed for {crate}: {e}")
        return None

def main():
    skip_tracker = {} # crate -> list of bad versions
    # Create symlink for agave
    os.system('ln -s /root/.local/share/solana/install/active_release/bin/agave-install /root/.local/share/solana/install/active_release/bin/solana-install 2>/dev/null')
    
    # Clean and initialize
    os.system('rm -f Cargo.lock programs/*/Cargo.lock')
    os.system('cargo generate-lockfile')
    
    # Pre-emptively fix blake3
    os.system('cargo update -p blake3 --precise 1.5.5 || true')
    
    iteration = 0
    max_iterations = 20
    
    while iteration < max_iterations:
        iteration += 1
        print(f"\n--- Iteration {iteration} ---")
        os.system("sed -i 's/version = 4/version = 3/g' Cargo.lock")
        
        print("Running cargo build-sbf...")
        res = subprocess.run(["cargo", "build-sbf"], capture_output=True, text=True)
        
        if res.returncode == 0:
            print("Build succeeded!")
            # Run test
            print("Running anchor test...")
            os.system("anchor test")
            break
            
        out = res.stderr
        
        # 1. Match rustc version error
        m_rustc = re.search(r"cargo update ([^@]+)@(\S+) --precise", out)
        if m_rustc:
            crate = m_rustc.group(1)
            bad_ver = m_rustc.group(2)
            spec = f"{crate}@{bad_ver}"
            skip_tracker.setdefault(crate, []).append(bad_ver)
            print(f"Detected rustc incompatibility in {spec}")
            downgrade_crate(spec, skip_tracker[crate])
            continue
            
        # 2. Match edition2024 error
        m_edition = re.search(r"failed to download `([^ ]+) v([^`]+)`.*?(?:feature `edition2024` is required|edition = \"2024\")", out, re.DOTALL)
        if m_edition:
            crate = m_edition.group(1)
            bad_ver = m_edition.group(2)
            spec = f"{crate}@{bad_ver}"
            skip_tracker.setdefault(crate, []).append(bad_ver)
            print(f"Detected edition2024 incompatibility in {spec}")
            downgrade_crate(spec, skip_tracker[crate])
            continue
            
        # 3. Handle feature digest error on blake3
        if "feature `digest` but `blake3` does not have that feature" in out:
            print("Detected digest feature missing on blake3, forcing 1.5.5")
            os.system('cargo update -p blake3 --precise 1.5.5')
            continue

        print("No parsable rustc/edition2024 error found. Dumping output snippet:")
        print(out[:1000])
        print("...[truncated]...")
        lines = out.split('\n')
        print('\n'.join(lines[-30:]))
        break

if __name__ == "__main__":
    main()
