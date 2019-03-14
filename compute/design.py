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

pla = { 'Name' : 'PLA'
      , 'YoungsModulus' : '3640 MPa'
      , 'PoissonRatio' : '0.360'
      , 'Density' : '1300 kg/m^3'}

PLA_YIELD_STRENGTH = 70 # MPa

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


    # FROM AUTOFEA
    def initialize(self):
        self.create_analysis()
        self.create_solver()
        self.create_material(pla)
        self.create_mesh()

    def create_analysis(self):
        self.analysis = ObjectsFem.makeAnalysis(self.doc, "Analysis")

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


    def score(self):
        try:
            self.initialize()
            self.constrain_by_auto()
            run = self.run()
        except Exception as e:
            return 'UNABLE TO SCORE'

        return PLA_YIELD_STRENGTH / max(run.StressValues)
