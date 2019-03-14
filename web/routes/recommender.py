import socket
import sys
sys.path.append('/usr/lib/freecad/lib')

import FreeCAD
import Part
import ObjectsFem
import Fem
from femmesh import gmshtools
from femtools import ccxtools

import json

# ===== Create Socket Server =====
HOST, PORT = '127.0.0.1', 9999
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.bind((HOST, PORT))
s.listen(1)
print "Listening on PORT ", PORT

conn, addr = s.accept()
print "Client: ", addr

while True:
    data = conn.recv(1024)
    if not data:
        break

    print "Received: " + data
    conn.sendall(data)
conn.close()
