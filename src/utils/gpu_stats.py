import sys, re
line = sys.stdin.read()
m = re.search(r'PerformanceStatistics[^{]*\{(.+?)\}', line)
if not m:
    print("device=0|renderer=0|tiler=0|vram=0")
    sys.exit()
body = m.group(1)
def get(key):
    m2 = re.search(re.escape(key) + r'["\s]*=\s*(\d+)', body)
    return m2.group(1) if m2 else "0"
dev  = get("Device Utilization %")
rend = get("Renderer Utilization %")
tile = get("Tiler Utilization %")
vram = get("In use system memory")
vram_mb = int(vram) // 1024 // 1024
print(f"device={dev}|renderer={rend}|tiler={tile}|vram={vram_mb}M")
