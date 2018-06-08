# **********************************
# *                                *
# * AutoFEA v0.5                   *
# *                                *
# * Ramana Nagasamudram            *
# * Aubhik Mazumdar                *
# * Prof. Jeffrey Nickerson        *
# *                                *
# **********************************

__title__ = "AutoFEA"
__author__ = "Ramana Nagasamudram"
__version__ = 0.5

import sys
import os
import ntpath # for basename
import argparse
# import materials
import warnings

warnings.filterwarnings('ignore')
# sys.path.append("C:\\Users\\Aubhik\\Desktop\\JN\\FreeCAD_0.17.13433_x64_dev_win\\FreeCAD_0.17.13433_x64_dev_win\\bin")
# sys.path.append("C:\\Users\\Aubhik\\Desktop\\JN\\FreeCAD_0.17.13433_x64_dev_win\\FreeCAD_0.17.13433_x64_dev_win\\Mod\\Fem")

sys.path.append('/usr/lib/freecad/lib')

pla = { 'Name' : 'PLA'
      , 'YoungsModulus' : '3640 MPa'
      , 'PoissonRatio' : '0.360'
      , 'Density' : '1300 kg/m^3'}

import FreeCAD
import Part
import ObjectsFem
import Fem
from femmesh import gmshtools # GMSH 
from femtools import ccxtools # Calculix

import json



class IncorrectFileType(Exception):
    def __init__(self,*args,**kwargs):
        Exception.__init__(self,*args,**kwargs)

class AutoFEA:
    def __init__(self, infile):
        self.name = ntpath.basename(infile) # includes '.step'
        self.name = os.path.splitext(self.name)[0]
        self.cad_file = infile
        if not self.check_file_format():
            raise IncorrectFileType("Input file is not a STEP file")

    def initialize(self):
        self.doc = FreeCAD.newDocument("AutoFEA")
        self.create_shape_from_file()
        self.create_analysis()
        self.create_solver()
        self.create_material(pla)
        self.create_mesh()

    def check_file_format(self):
        formats = ['.step', '.STEP', '.stp', '.STP']
        fname, fext = os.path.splitext(self.cad_file)
        return fext in formats

    def create_shape_from_file(self):
        self.shape = Part.Shape()
        self.shape.read(self.cad_file)
        self.doc.addObject("Part::Feature", "Geometry")
        self.doc.Geometry.Shape = self.shape

    def move_shape_till_pos_static_moments(self):
        v = FreeCAD.Vector
        ispos = all([d > 0 for d in self.doc.Geometry.Shape.StaticMoments])
        rvecs = [v(1,0,0),v(0,1,0),v(0,0,1)]
        base = self.doc.Geometry.Shape.Placement.Base
        while not ispos:
            for a in [0,90,180]:
                for r in rvecs:
                    self.doc.Geometry.Placement = FreeCAD.Placement(base,r,a)
                    ispos = all([d > 0 for d in
                                 self.doc.Geometry.Shape.StaticMoments])

    def create_analysis(self):
        self.analysis = ObjectsFem.makeAnalysis(self.doc, "Analysis")
        print "ANALYSIS: ", self.analysis

    def create_solver(self):
        solver = ObjectsFem.makeSolverCalculix(self.doc, "CalculiX")
        solver.GeometricalNonlinearity = 'linear'
        solver.ThermoMechSteadyState = True
        solver.IterationsControlParameterTimeUse = False
        self.solver = solver
        self.analysis.addObject(self.solver)

    def create_material(self, material):
        material_obj = ObjectsFem.makeMaterialSolid(self.doc, "Material")
        material_obj.Material = material
        self.analysis.addObject(material_obj)

    def create_mesh(self):
        self.mesh = ObjectsFem.makeMeshGmsh(self.doc, "Mesh")
        self.doc.Mesh.Part = self.doc.Geometry
        g = gmshtools.GmshTools(self.doc.Mesh)
        g.create_mesh()
        self.analysis.addObject(self.mesh)

    def constrain_by_points(self, force_points, fixed_points, force_dir_point):
        force_vectors = []
        for i in range(0, len(force_points), 3):
            force_vectors.append(FreeCAD.Vector(force_points[i:i+3]))

        fixed_vectors = []
        for i in range(0, len(fixed_points), 3):
            fixed_vectors.append(FreeCAD.Vector(fixed_points[i:i+3]))

        force_direction = FreeCAD.Vector(force_dir_point)

        tol = 0.001
        self.force_faces = []
        self.fixed_faces = []
        self.force_dir = None
        for idx, face in enumerate(self.shape.Faces):
            face_str = "Face" + str(idx+1)
            for vector in force_vectors:
                if face.isInside(vector, tol, True):
                    self.force_faces.append(face_str)
            for vector in fixed_vectors:
                if face.isInside(vector, tol, True):
                    self.fixed_faces.append(face_str)
            if face.isInside(force_direction, tol, True):
                self.force_dir = face_str
                self.create_constraints()


    def constrain_by_plane(self, force_plane, fixed_plane):
        planes = {'x' : 0, 'y' : 1, 'z' : 2}
        faces_aug = list(enumerate(self.shape.Faces))
        select_com = lambda x : lambda y : y[1].CenterOfMass[x]

        force_apply = list(set("xyz") - set(force_plane))[0]
        fixed_apply = list(set("xyz") - set(fixed_plane))[0]

        force_possible_faces = [min(faces_aug, key=select_com(planes[force_apply])),
                                max(faces_aug, key=select_com(planes[force_apply]))]
        fixed_possible_faces = [min(faces_aug, key=select_com(planes[fixed_apply])),
                                max(faces_aug, key=select_com(planes[fixed_apply]))]
        
        self.force_faces = ["Face" + str(min(force_possible_faces, key=lambda x:x[1].Area)[0]+1)]
        self.fixed_faces = ["Face" + str(min(fixed_possible_faces, key=lambda x:x[1].Area)[0]+1)]

        self.force_dir = "Face" + str(max(fixed_possible_faces, key=lambda x:x[1].Area)[0] + 1)
        self.create_constraints()


    def constrain_by_auto(self):
        """Automatically add constraints to the object.
        Traverses the faces in the object's shape to understand
        object's orientation and then applies constraints appropriately"""
        # Needs refactoring
        
        faces_aug = list(enumerate(self.shape.Faces))

        # x[1] since this will be working on (<int>, <face>) tuples and we
        # want to access an attribute from the <face> bit
        extrem_selector = lambda y: lambda x: x[1].BoundBox.Center.__getattribute__(y)

        def min_max(ls, sel):
            return [min(ls, key=sel), max(ls, key=sel)]

        # faces at extremities of x, y, z axes
        extrem_x = min_max(faces_aug, extrem_selector('x'))
        extrem_y = min_max(faces_aug, extrem_selector('y'))
        extrem_z = min_max(faces_aug, extrem_selector('z'))

        # print "EXTREM_X", extrem_x
        # print "EXTREM_Y", extrem_y
        # print "EXTREM_Z", extrem_z

        tol = 0.00001
        
        get_bbxdiag = lambda e: e.BoundBox.DiagonalLength
        in_tol = lambda s, r : abs(s - r) <= tol
        # same_bbxes = lambda e: get_bbxdiag(e[0][1]) == get_bbxdiag(e[1][1])
        same_bbxes = lambda e: in_tol(get_bbxdiag(e[0][1]),get_bbxdiag(e[1][1]))

        consider = []
        for faces in [extrem_x, extrem_y, extrem_z]:
            # print "FINDING OUT WHICH FACES TO CONSIDER"
            # print "LOOP"
            # print "  - FACE : ", faces[0][1], " DIAG : ", get_bbxdiag(faces[0][1])
            # print "  - FACE : ", faces[1][1], " DIAG : ", get_bbxdiag(faces[1][1])
            # print "  - SAME_BBX : ", same_bbxes(faces)
            if not same_bbxes(faces):
                # print "    - DIDN'T FIND FACE'S WITH MATCHING DIAG"
                # print "    - FACES ", faces[0][0], faces[1][0]
                consider.append(faces)

        # print "LEN(CONSIDER) = ", len(consider)
        # print "CONSIDER ", consider
        # assert(len(consider) == 2)

        final_faces = []
        for faces in consider:
            final_faces.append(min(faces, key=lambda e: get_bbxdiag(e[1])))

        # print "LEN(FINAL_FACES) = ", len(final_faces)
        # assert(len(final_faces) == 2)

        force_face = final_faces[0][0] + 1
        fixed_face = final_faces[1][0] + 1

        self.force_faces = ["Face" + str(force_face)]
        self.fixed_faces = ["Face" + str(fixed_face)]
        self.force_dir = "Face" + str(fixed_face)

        self.create_constraints()
        return

    def create_constraints(self, force_quant=100.0):
        force_constraint = ObjectsFem.makeConstraintForce(self.doc, "FemForceConstraint")

        force_references = []
        for face in self.force_faces:
            force_references.append((self.doc.Geometry, face))
            # print "FORCE-REFERENCES : ", force_references

        force_constraint.References = force_references
        force_constraint.Force = force_quant
        force_constraint.Direction = (self.doc.Geometry, self.force_dir)

        fixed_constraint = ObjectsFem.makeConstraintFixed(self.doc, "FemFixedConstraint")
        fixed_references = []
        for face in self.fixed_faces:
            fixed_references.append((self.doc.Geometry, face))
            fixed_constraint.References = fixed_references

        self.analysis.addObject(force_constraint)
        self.analysis.addObject(fixed_constraint)

    def run(self):
        # self.doc.recompute()
        fea = ccxtools.FemToolsCcx(analysis=self.analysis, solver=self.solver, test_mode=False)
        # fea.setup_working_dir('solver-tmp')
        self.doc.recompute()
        message = fea.update_objects()
        if not message:
            fea.reset_all()
            fea.run()
            fea.load_results()
        else:
            raise Exception('AutoFEA -- error while running FEA analysis - {}'.format(message))

        for mem in self.analysis.Group:
            if mem.isDerivedFrom('Fem::FemResultObject'):
                return mem

    def to_stl(self, path):
        import Mesh
        Mesh.export([self.doc.Geometry], path)


def create_autofea_and_run(filepath, savedir=False, tofile=False):
    a = AutoFEA(filepath)
    a.initialize()
    a.constrain_by_auto()
    results = a.run()
    if savedir:
        a.to_stl(savedir + a.name + '.stl')
    if tofile:
        with open(savedir + a.name + '.txt','w') as f:
            f.write('-' * 79 + '\n')
            f.write(a.name + " results" + '\n')
            f.write('-' * 79 + '\n')
            f.write('\n')
            f.write('Max Displacement : ' + str(max(results.DisplacementLengths)) + '\n')
            f.write('Max Stress Value : ' + str(max(results.StressValues)) + '\n')
            f.write('Max Shear Value  : ' + str(max(results.MaxShear)) + '\n')
            f.write('Max Principal Max: ' + str(max(results.PrincipalMax)) + '\n')
            f.write('Max Principal Med: ' + str(max(results.PrincipalMed)) + '\n')
            f.write('Max Principal Min: ' + str(max(results.PrincipalMin)) + '\n')
            f.write('\n')
            f.write('-' * 79)
            f.close()
    return results

def create_and_run_json_out(filepath, savedir='./'):
    a = AutoFEA(filepath)
    a.initialize()
    a.constrain_by_auto()
    run = a.run()
    if savedir:
        a.to_stl(savedir + a.name + '.stl')

    results = dict()
    results['MaxDisplacement'] = max(run.DisplacementLengths)
    results['MaxStressValue'] = max(run.StressValues)
    results['MaxShearValue'] = max(run.MaxShear)
    results['MaxPrincipalMax'] = max(run.PrincipalMax)
    results['MaxPrincipalMed'] = max(run.PrincipalMed)
    results['MaxPrincipalMin'] = max(run.PrincipalMin)

    print results

    return json.dumps(results)

parser = argparse.ArgumentParser(description='Automated FEM analysis on L-Brackets')
parser.add_argument('input',metavar='input-file',help='CAD file (STEP format)')
parser.add_argument('-s','--save-stl',nargs='?',const=True,help='Directory to store STL output in')
# parser.add_argument('-r','--result-file',nargs='?',const=True,help='Directory to store results file in')

args = parser.parse_args()
resu = create_and_run_json_out(args.input, args.save_stl)

print resu
sys.stdout.flush()    

