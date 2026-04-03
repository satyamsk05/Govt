import subprocess
import os

def run_script(script_name):
    print(f"\n--- Running {script_name} ---")
    try:
        result = subprocess.run(["python3", script_name], check=True, text=True, capture_output=True)
        print(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error running {script_name}:")
        print(e.stderr)
        return False
    return True

def main():
    scripts = [
        "scraper.py",
        "generator.py",
        "integrate.py"
    ]
    
    for script in scripts:
        if not run_script(script):
            print(f"Stopping at {script} due to error.")
            break
    else:
        print("\nAll scripts executed successfully!")

if __name__ == "__main__":
    main()
