import sys
import os
import ntpath # for basename
import argparse

sys.path.append('/usr/lib/freecad/lib')

import FreeCAD
import Part
import Mesh

class IncorrectFileType(Exception):
    def __init__(self,*args,**kwargs):
        Exception.__init__(self,*args,**kwargs)

def step_to_stl(infile, outdir):
    formats = ['.step', '.STEP', '.stp', '.STP']
    fname, fext = os.path.splitext(infile)
    if not fext in formats:
        raise IncorrectFileType("Input file needs to be a STEP file")

    name = ntpath.basename(infile)
    name = os.path.splitext(name)[0]
    doc = FreeCAD.newDocument("Conversion")
    shape = Part.Shape()
    shape.read(infile)
    doc.addObject("Part::Feature", "Geometry")
    doc.Geometry.Shape = shape
    Mesh.export([doc.Geometry], outdir + name + '.stl')
    
    

parser = argparse.ArgumentParser(description='Convert a STEP file to an STL file using FreeCAD')
parser.add_argument('input',metavar='input-file',help='Path to input file')
parser.add_argument('output',metavar='output-directory',help='Output directory')

args = parser.parse_args()
step_to_stl(args.input, args.output)
