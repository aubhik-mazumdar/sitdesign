import json
import ntpath
import numpy as np
import operator
import os
import pickle
import socket
import sys
import time

sys.path.append('/usr/lib/freecad/lib')
import FreeCAD
import Part
import ObjectsFem
import Fem
import Mesh
from femmesh import gmshtools
from femtools import ccxtools

class Design(object):
    count = 0
    
    def __init__(self, user, infile, init_count=None):
        if init_count:
            self.__class__.count = init_count
        else:
            self.__class__.count += 1
            
        self.infile = infile
        self.design_id = self.__class__.count
        self.user = user
        self.name = os.path.splitext(ntpath.basename(infile))[0]
        self.full_name = (self.user, self.name)
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

    @property
    def volume(self):
        return self.shape.Volume

    @property
    def area(self):
        return self.shape.Area

    @property
    def nfaces(self):
        return len(self.shape.Faces)

    @property
    def fill(self):
        return self.shape.Volume / self._bbx_volume()

    @property
    def avg_face_area(self):
        return self.area / self.nfaces

    @property
    def coordinates(self):
        logv = np.log(self.volume)
        logafa = np.log(self.avg_face_area)
        nf = self.nfaces
        return {'avg_face_area': logafa, 'volume': logv, 'nfaces': nf}

    def _bbx_volume(self):
        bbx = self.shape.BoundBox
        return bbx.XLength * bbx.YLength * bbx.ZLength

class DesignDomain(object):
    def __init__(self):
        self.designs = {}
        iden = lambda x: x
        logt = lambda x: np.log(x)
        self.v = [('volume', logt), ('avg_face_area', logt), ('nfaces', iden)]
        self.dmat = None

    def sort_by(self, attr):
        s = sorted(self.designs.items(), key=lambda x: x[1].__getattribute__(attr))
        return s

    def add_design(self, des):
        self.designs[des.full_name] = des
        self.compute_matrix()
        return

    def get_last_design(self, user):
        user_designs = filter(lambda x: x.full_name[0] == user, self.designs.values())
        last_design = max(user_designs, key=lambda x: x.design_id)
        print 'User: ' + str(user) + ' Last Design: ' + str(last_design.name)
        return last_design

    def remove_design(self, name):
        print("FUNCTION NOT FULLY IMPLEMENTED")
        del self.designs[name]

    @property
    def users(self):
        return map(lambda x: x[0], self.designs.keys())

    @property
    def names(self):
        return list(self.designs.keys())

    @property
    def variables(self):
        return self.v

    @variables.getter
    def variables(self):
        return map(lambda x: x[0], self.v)

    @variables.setter
    def variables(self, value):
        self.v = value

    @property
    def origin(self):
        return (0,) * len(self.v)

    def compute_matrix(self):
        self.measure = 'l2'
        M = {}
        for i in self.designs:
            for j in self.designs:
                if i not in M.keys():
                    M[i] = {}
                if i == j:
                    continue
                M[i][j] = self._distance(i, j, self.measure)
        self.dmat = M
        return M

    def nearest(self, obj, n=5):
        dists = self.dmat[obj]
        revr = self.measure == 'cosine'
        s = sorted(dist.items(), key=operator.itemgetter(1), reverse=revr)
        return s[:n]

    def farthest(self, obj, n=5):
        dists = self.dmat[obj]
        revr = self.measure != 'cosine'
        s = sorted(dists.items(), key=operator.itemgetter(1), reverse=revr)
        return s[:n]

    def _distance(self, v1, v2, method='l2'):
        if method == 'l2':
            v1 = self._coordinates(v1)
            v2 = self._coordinates(v2)
            return np.sqrt(reduce(lambda a, x: (x[1]-x[0])**2 + a, zip(v1,v2), 0))
        elif method == 'cosine':
            return self._cosine_distance(v1, v2)

    def _cosine_distance(self, v1, v2):
        n1 = self._norm(v1)
        n2 = self._norm(v2)
        v1c = self._coordinates(v1)
        v2c = self._coordinates(v2)
        return np.dot(v1c, v2c) / (n1 * n2)

    def _coordinates(self, obj):
        obj = self.designs[obj]
        return map(lambda x: x[1](obj.__getattribute__(x[0])), self.v)

    def _norm(self, obj):
        return math.sqrt(reduce(lambda a, x: x*x + a, self._coordinates(obj)))

    def __len__(self):
        return len(self.designs)

    def __getitem__(self, item):
        return self.designs[item]

def design_domain(filename='design-domain.pickle'):
    if os.path.exists(filename):
        with open(filename, 'rb') as f:
            return pickle.load(f)
    return DesignDomain()

def cache_design_domain(dom, filename='design-domain.pickle'):
    with open(filename, 'wb') as f:
        pickle.dump(dom, f) # only pickle the distance matrix
    return

Dom = design_domain()
print('Initial Distance Matrix: ')
print(Dom.dmat)

# --- Socket Server ---

HOST, PORT = '127.0.0.1', 8080

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind((HOST, PORT))
s.listen(1)

print 'Listening on PORT ', PORT

# conn, addr = s.accept()
# print 'Client: ', addr

while True:
    conn, addr = s.accept()
    print 'Client: ', addr
    data = conn.recv(1024)
    if not data:
        break
    request = json.loads(data)
    print 'SERVER: received: ' + str(request)
    command = request['command']

    if command == u'PROCESS': # might not actually need this check
        print(request)
        des = Design(request['userName'], request['filePath'])
        print("'Full' name of uploaded design")
        print(des.full_name)
        Dom.add_design(des)
        print('Total designs so far: ',  str(des.count))
        print('Converting to STL')

        # build result object to send to client.
        result = des.to_stl(request['fileDir'])
        result['properties'] = des.coordinates
        result['design_id'] = des.design_id

        print(result)
        print('Distance Matrix: ')
        print(Dom.dmat)

        # time.sleep(20) # delay for 20 seconds -- testing responsiveness of website
        conn.sendall(json.dumps(result))

    elif command == u'RECOMMEND':
        print(request)
        

cache_design_domain(Dom)        

conn.close()

# Serialize objects
# - Distance Matrix
# - Remix Graph
# - Store design_id count <- can be recovered using len(dist_mat)
