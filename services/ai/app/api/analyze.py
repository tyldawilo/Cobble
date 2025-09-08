import os
import time
from fastapi import APIRouter
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from io import BytesIO
try:
    from PyNite import FEModel3D
    import numpy as np  # PyNite depends on numpy; ensures import succeeds
except Exception:
    FEModel3D = None  # optional in case install fails; we will mock
from ..models.inputs import AnalyzeRequest

router = APIRouter()


@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    started = time.time()
    # Try a tiny PyNite model if available (beam with two supports and uniform loads)
    results = {
        "project_id": req.project_id,
        "analysis_summary": {"max_displacement_mm": 12.3, "max_moment_kNm": 45.6},
        "elements": [
            {
                "element_id": "B1",
                "element_type": "beam",
                "geometry": {"length": 5.0, "width": 0.3, "height": 0.5},
                "reinforcement": {"main_steel_area": 1200.0, "stirrup_spacing": 150.0},
                "sans_checks": [
                    {"clause": "SANS 10100-1:2000 3.3", "description": "Minimum cover", "value": 25, "limit": 25, "status": "pass", "utilization": 0.9},
                    {"clause": "SANS 10100-1:2000 4.4", "description": "Shear capacity", "value": 180, "limit": 200, "status": "warning", "utilization": 0.9},
                ],
                "overall_status": "warning",
                "max_utilization": 0.9,
            }
        ],
        "overall_compliance": True,
    }

    try:
        if FEModel3D is not None:
            model = FEModel3D()
            # Geometry and properties (very simplified)
            L = 5.0
            E = 30e9  # Pa
            I = 0.3 * 0.5**3 / 12.0
            A = 0.3 * 0.5
            model.add_node('N1', 0, 0, 0)
            model.add_node('N2', L, 0, 0)
            model.add_member('B1', 'N1', 'N2', E, G=E/2.6, Ix=I, Iy=I, Iz=I, J=1.0, A=A)
            model.def_support('N1', True, True, True, True, True, True)
            model.def_support('N2', True, True, True, True, True, True)
            # Convert kN to N and kN/m to N/m for example loads
            w_total = (req.design_inputs.dead_load + req.design_inputs.live_load) * 1000.0
            model.add_member_dist_load('B1', Direction='Fy', w1=-w_total, w2=-w_total)
            model.analyze(check_statics=False)
            mm = max(abs(model.get_max_shear('B1')), abs(model.get_max_moment('B1')))
            max_def = abs(model.get_max_deflection('B1'))
            results['analysis_summary'] = {
                'max_displacement_mm': max_def * 1000.0,
                'max_moment_kNm': mm / 1000.0
            }
            # Simple utilization proxy: span/deflection ratio target, not actual SANS
            util = min(1.0, (max_def * 1000.0) / 20.0)  # pretend limit L/250 ~ 20 mm for mock 5 m span
            results['elements'][0]['max_utilization'] = util
            results['overall_compliance'] = util < 1.0
    except Exception:
        # On any failure, keep mock defaults
        pass

    duration = time.time() - started

    # Generate a minimal PDF report in-memory
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, height - 72, "Cobble Preliminary Structural Report (Mock)")
    c.setFont("Helvetica", 11)
    c.drawString(72, height - 100, f"Project ID: {req.project_id}")
    c.drawString(72, height - 118, f"Overall compliance: {results.get('overall_compliance')}")
    el = results.get("elements", [{}])[0]
    c.drawString(72, height - 136, f"Element: {el.get('element_id', '-')}, Type: {el.get('element_type', '-')}")
    c.drawString(72, height - 154, f"Max utilization: {el.get('max_utilization', '-')}")
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(72, 72, "Engineering disclaimer: Results are preliminary and require review by a qualified professional.")
    c.showPage()
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()

    # Return report bytes as base64 for Edge Function to store in Supabase Storage
    import base64
    report_b64 = base64.b64encode(pdf_bytes).decode("ascii")

    return {
        "success": True,
        "analysis_id": f"mock-{int(started)}",
        "results": results,
        "analysis_duration_seconds": duration,
        "report": {"filename": f"report_{req.project_id}.pdf", "content_b64": report_b64, "content_type": "application/pdf"},
    }


