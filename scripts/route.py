"""FFXIV Ocean Fishing schedule calculator - Indigo AND Ruby (post-7.5: 9 Ruby routes).
Indigo verified vs ffxiv.pf-n.co; Ruby verified vs ffxiv.oceanfishing.boats time calculator.
Voyages depart on odd hours JST (== even hours UTC), every 2 hours.
"""
import time, datetime
from datetime import timezone, timedelta

TWO_HOURS_MS = 7200000
INDIGO = ["BD", "TD", "ND", "RD", "BS", "TS", "NS", "RS", "BN", "TN", "NN", "RN", "TD", "ND", "RD", "BS", "TS", "NS", "RS", "BN", "TN", "NN", "RN", "BD", "ND", "RD", "BS", "TS", "NS", "RS", "BN", "TN", "NN", "RN", "BD", "TD", "RD", "BS", "TS", "NS", "RS", "BN", "TN", "NN", "RN", "BD", "TD", "ND", "BS", "TS", "NS", "RS", "BN", "TN", "NN", "RN", "BD", "TD", "ND", "RD", "TS", "NS", "RS", "BN", "TN", "NN", "RN", "BD", "TD", "ND", "RD", "BS", "NS", "RS", "BN", "TN", "NN", "RN", "BD", "TD", "ND", "RD", "BS", "TS", "RS", "BN", "TN", "NN", "RN", "BD", "TD", "ND", "RD", "BS", "TS", "NS", "BN", "TN", "NN", "RN", "BD", "TD", "ND", "RD", "BS", "TS", "NS", "RS", "TN", "NN", "RN", "BD", "TD", "ND", "RD", "BS", "TS", "NS", "RS", "BN", "NN", "RN", "BD", "TD", "ND", "RD", "BS", "TS", "NS", "RS", "BN", "TN", "RN", "BD", "TD", "ND", "RD", "BS", "TS", "NS", "RS", "BN", "TN", "NN"]
INDIGO_OFFSET = 88
DEST_INDIGO = {"B": "Bloodbrine Sea", "T": "Rothlyt Sound",
               "N": "Northern Strait of Merlthor", "R": "Rhotano Sea"}
TOD = {"D": "Day", "S": "Sunset", "N": "Night"}

def indigo(unix_ms):
    vn = unix_ms // TWO_HOURS_MS
    c = INDIGO[(INDIGO_OFFSET + vn) % len(INDIGO)]
    return DEST_INDIGO[c[0]], TOD[c[1]]

RUBY = ["Squid/Taniwha", "Prehistoric/Akupara", "Glass Dragon & Jewel", "Prehistoric/Akupara", "Squid/Glass Dragon", "Mantis/Taniwha", "Shellfish/Shrimp", "Mantis/Taniwha", "Mantis/Manasvin", "Shellfish/Taniwha", "Mantis/Manasvin", "Squid/Taniwha", "Prehistoric/Akupara", "Glass Dragon & Jewel", "Prehistoric/Akupara", "Squid/Glass Dragon", "Mantis/Taniwha", "Shellfish/Shrimp", "Mantis/Taniwha", "Shrimp/Hells' Claw", "Shellfish/Taniwha", "Mantis/Manasvin", "Squid/Taniwha", "Prehistoric/Akupara", "Glass Dragon & Jewel", "Prehistoric/Akupara", "Squid/Glass Dragon", "Mantis/Taniwha", "Shellfish/Shrimp", "Mantis/Taniwha", "Shrimp/Hells' Claw", "Mantis/Manasvin", "Mantis/Manasvin", "Squid/Taniwha", "Prehistoric/Akupara", "Glass Dragon & Jewel", "Prehistoric/Akupara", "Squid/Glass Dragon", "Mantis/Taniwha", "Shellfish/Shrimp", "Mantis/Taniwha", "Shrimp/Hells' Claw", "Mantis/Manasvin", "Shellfish/Taniwha", "Squid/Taniwha", "Prehistoric/Akupara", "Glass Dragon & Jewel", "Prehistoric/Akupara", "Squid/Glass Dragon", "Mantis/Taniwha", "Shellfish/Shrimp", "Mantis/Taniwha", "Shrimp/Hells' Claw", "Mantis/Manasvin", "Shellfish/Taniwha", "Mantis/Manasvin", "Prehistoric/Akupara", "Glass Dragon & Jewel", "Prehistoric/Akupara", "Squid/Glass Dragon", "Mantis/Taniwha", "Shellfish/Shrimp", "Mantis/Taniwha", "Shrimp/Hells' Claw", "Mantis/Manasvin", "Shellfish/Taniwha", "Mantis/Manasvin", "Squid/Taniwha", "Glass Dragon & Jewel", "Prehistoric/Akupara", "Squid/Glass Dragon", "Mantis/Taniwha", "Shellfish/Shrimp", "Mantis/Taniwha", "Shrimp/Hells' Claw", "Mantis/Manasvin", "Shellfish/Taniwha", "Mantis/Manasvin", "Squid/Taniwha", "Prehistoric/Akupara", "Prehistoric/Akupara", "Squid/Glass Dragon", "Mantis/Taniwha", "Shellfish/Shrimp", "Mantis/Taniwha", "Shrimp/Hells' Claw", "Mantis/Manasvin", "Shellfish/Taniwha", "Mantis/Manasvin", "Squid/Taniwha", "Prehistoric/Akupara", "Glass Dragon & Jewel", "Squid/Glass Dragon", "Mantis/Taniwha", "Shellfish/Shrimp", "Mantis/Taniwha", "Shrimp/Hells' Claw", "Mantis/Manasvin", "Shellfish/Taniwha", "Mantis/Manasvin", "Squid/Taniwha", "Prehistoric/Akupara", "Glass Dragon & Jewel", "Prehistoric/Akupara", "Mantis/Taniwha", "Shellfish/Shrimp", "Mantis/Taniwha", "Shrimp/Hells' Claw", "Mantis/Manasvin", "Shellfish/Taniwha", "Mantis/Manasvin", "Squid/Taniwha", "Prehistoric/Akupara", "Glass Dragon & Jewel", "Prehistoric/Akupara", "Squid/Glass Dragon", "Shellfish/Shrimp", "Mantis/Taniwha", "Shrimp/Hells' Claw", "Mantis/Manasvin", "Shellfish/Taniwha", "Mantis/Manasvin", "Squid/Taniwha", "Prehistoric/Akupara", "Glass Dragon & Jewel", "Prehistoric/Akupara", "Squid/Glass Dragon", "Mantis/Taniwha", "Mantis/Taniwha", "Shrimp/Hells' Claw", "Mantis/Manasvin", "Shellfish/Taniwha", "Mantis/Manasvin", "Squid/Taniwha", "Prehistoric/Akupara", "Glass Dragon & Jewel", "Prehistoric/Akupara", "Squid/Glass Dragon", "Mantis/Taniwha", "Shellfish/Shrimp", "Shrimp/Hells' Claw", "Mantis/Manasvin", "Shellfish/Taniwha", "Mantis/Manasvin"]
RUBY_ROUTES = {"Shellfish/Shrimp": [["The Sirensong Sea", "Night"], ["Kugane", "Day"], ["The One River", "Sunset"]], "Shrimp/Hells' Claw": [["The Sirensong Sea", "Night"], ["Kugane", "Day"], ["The Ruby Sea", "Sunset"]], "Shellfish/Taniwha": [["The Sirensong Sea", "Day"], ["Kugane", "Sunset"], ["The One River", "Night"]], "Squid/Taniwha": [["The Sirensong Sea", "Day"], ["Kugane", "Sunset"], ["The Ruby Sea", "Night"]], "Squid/Glass Dragon": [["The Sirensong Sea", "Sunset"], ["Kugane", "Night"], ["The Ruby Sea", "Day"]], "Glass Dragon & Jewel": [["The Sirensong Sea", "Sunset"], ["Kugane", "Night"], ["The One River", "Day"]], "Mantis/Taniwha": [["Unnamed Island", "Night"], ["The Sirensong Sea", "Day"], ["Thavnair", "Sunset"]], "Mantis/Manasvin": [["Unnamed Island", "Day"], ["The Sirensong Sea", "Sunset"], ["Thavnair", "Night"]], "Prehistoric/Akupara": [["Unnamed Island", "Sunset"], ["The Sirensong Sea", "Night"], ["Thavnair", "Day"]]}

def ruby(unix_ms):
    vn = unix_ms // TWO_HOURS_MS
    name = RUBY[vn % len(RUBY)]
    return name, RUBY_ROUTES[name]

def next_voyage(now_ms=None):
    now_ms = now_ms if now_ms is not None else int(time.time() * 1000)
    return ((now_ms // TWO_HOURS_MS) + 1) * TWO_HOURS_MS

def upcoming(route="indigo", n=8, now_ms=None):
    v0 = next_voyage(now_ms); out=[]
    for i in range(n):
        ms = v0 + i * TWO_HOURS_MS
        out.append((datetime.datetime.fromtimestamp(ms/1000, timezone.utc),
                    indigo(ms) if route=="indigo" else ruby(ms)))
    return out

if __name__ == "__main__":
    for rt in ("indigo", "ruby"):
        print("==", rt, "==")
        for dt, res in upcoming(rt, 10):
            if rt == "indigo":
                print(" ", dt.strftime("%m-%d %H:%M UTC"), res[0], "|", res[1])
            else:
                print(" ", dt.strftime("%m-%d %H:%M UTC"), res[0], "|",
                      " -> ".join(f"{s[0]} ({s[1]})" for s in res[1]))
