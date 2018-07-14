import os
import sys
import ntpath
import argparse
import math
import operator

import numpy as np

sys.path.append('/usr/lib/freecad/lib')

import FreeCAD
import Part

class IncorrectFileType(Exception):
    def __init__(self, *args, **kwargs):
        Exception.__init__(self, *args, **kwargs)

class Design(object):
    def __init__(self, infile):
        self.cad_file = infile
        self.name = os.path.splitext(ntpath.basename(infile))[0]
        if not self._check_file_format():
            err_msg = self.name + " is not a STEP file"
            raise IncorrectFileType(err_msg)
        self.doc = FreeCAD.newDocument(self.name)
        self.shape = self._create_shape()

    @property
    def volume(self):
        return self.shape.Volume

    @property
    def area(self):
        return self.shape.Area

    @property
    def fill(self):
        return self.shape.Volume / self._bbx_volume()

    @property
    def nfaces(self):
        return len(self.shape.Faces)

    @property
    def avg_face_area(self):
        return self.area / self.nfaces

    @property
    def coordinates(self):
        logv = math.log(self.volume)
        logafa = math.log(self.avg_face_area)
        nf = self.nfaces
        return (logv, logafa, nf)

    def _bbx_volume(self):
        bbx = self.shape.BoundBox
        return bbx.XLength * bbx.YLength * bbx.ZLength

    def _check_file_format(self):
        formats = ['.step', '.STEP', '.stp', '.STP']
        _, fext = os.path.splitext(self.cad_file)
        return fext in formats

    def _create_shape(self):
        shape = Part.Shape()
        shape.read(self.cad_file)
        self.doc.addObject("Part::Feature", "Geometry")
        self.doc.Geometry.Shape = shape
        return self.doc.Geometry.Shape # for convenience

parser = argparse.ArgumentParser(description='Get the coordinates of a design in some feature space')
parser.add_argument('input', metavar='input-file', help='Path to input file')

args = parser.parse_args()
d = Design(args.input)
print
print d.coordinates
print math.log(d.volume)
print math.log(d.avg_face_area)
print d.nfaces
