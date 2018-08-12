import json
import os
import ntpath
import numpy as np
import socket
import sys

sys.path.append('/usr/lib/freecad/lib')
import FreeCAD
import Part
import ObjectsFem
import Fem
import Mesh
from femmesh import gmshtools
from femtools import ccxtools

def step_to_stl(infile, outdir):
    name = ntpath.basename(infile)
    name = os.path.splitext(name)[0]
    doc = FreeCAD.newDocument('Conversion')
    shape = Part.Shape()
    shape.read(infile)
    doc.addObject('Part::Feature', 'Geometry')
    doc.Geometry.Shape = shape
    Mesh.export([doc.Geometry], os.path.join(outdir, name + '.stl'))
    return {'results': 'SUCCESS'}

class Design(object):
    def __init__(self, user, infile):
        self.infile = infile
        self.user = user
        self.name = os.path.splitext(ntpath.basename(infile))[0]
        self.full_name = self.user + ':' + self.name
        self.doc = FreeCAD.newDocument(self.name)
        self.shape = self._create_shape()

    def _create_shape(self):
        shape = Part.Shape()
        shape.read(self.infile)
        self.doc.addObject('Part::Feature', 'Geometry')
        self.doc.Geometry.Shape = shape
        return self.doc.Geometry.Shape # for convenience

    def to_stl(self, outdir):
        Mesh.export([self.doc.Geometry], os.path.join(outdir, self.name + '.stl'))
        return {'operation': 'CONVERT', 'result': 'SUCCESS'}

# --- Socket Server ---

HOST, PORT = '127.0.0.1', 8080

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind((HOST, PORT))
s.listen(1)

print 'Listening on PORT ', PORT

conn, addr = s.accept()
print 'Client: ', addr

while True:
    data = conn.recv(1024)
    if not data:
        break
    request = json.loads(data)
    print 'SERVER: received: ' + str(request)
    command = request['command']
    if command == u'PROCESS':
        print(request)
        des = Design(request['userName'], request['filePath'])
        print('Converting to STL')
        result = des.to_stl(request['fileDir'])
        print(result)
        conn.sendall(json.dumps(result))
        print('Continuing processing. The website should route the user to the homepage at this step.')
        print('Alternatively, the user can be redirected to the homepage at an earlier step.')
    if command == u'CONVERT':
        print('step_to_stl({},{})'.format(request['filePath'], request['fileDir']))
        print(os.path.join(request['fileDir'], os.path.splitext(ntpath.basename(request['fileName']))[0] + '.stl'))
        result = step_to_stl(request['filePath'], request['fileDir'])
        print(result)
        conn.sendall(json.dumps(result))
    if command == u'COMPUTE-DISTANCE':
        print('compute_distance({},{})'.format(request['filePath'], request['fileDir']))
        
conn.close()
