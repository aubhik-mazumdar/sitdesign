import ntpath
import os
import sys

sys.path.append('/usr/lib/freecad/lib')

import numpy as np

import FreeCAD
import Part
import ObjectsFem
import Fem
import Mesh
from femmesh import gmshtools
from femtools import ccxtools

# In the future will have to import AutoFEA here as well?

class Design(object):
    def __init__(self, infile, user=None):
        self.infile = infile
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

    def to_stl(self, outdir): # to_stl : FilePath -> Boolean
        Mesh.export([self.doc.Geometry], os.path.join(outdir, self.name + '.stl'))
        return {'operation': 'CONVERT', 'result': 'SUCCESS'}

    def to_render_path(self):
        # NOTE that the convention for representing filenames
        # must be standardized.
        return self.user + '/' + self.name + '.stl'

    def _volume(self):
        return self.shape.Volume

    def _area(self):
        return self.shape.Area

    def _nfaces(self):
        return len(self.shape.Faces)

    def _fill(self):
        return self.shape.Volume / self._bbx_volume()

    def _avg_face_area(self):
        return self._area() / self._nfaces()

    def _bbx_volume(self):
        bbx = self.shape.BoundBox
        return bbx.XLength * bbx.YLength * bbx.ZLength

    def project(self):
        return {'avg_face_area': np.log(self._avg_face_area())
                , 'volume': np.log(self._volume())
                , 'nfaces': self._nfaces()}

