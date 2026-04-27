import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Session } from '../App';
import { format } from 'date-fns';

export const generateClinicalReport = (session: Session) => {
  const doc = new jsPDF();
  const dateStr = format(session.timestamp, 'yyyy-MM-dd HH:mm:ss');
  const fileName = `NeuroTremor_Report_${format(session.timestamp, 'yyyyMMdd_HHmm')}.pdf`;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(16, 185, 129); // Emerald 500
  doc.text('NeuroTremor Clinical Assessment', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Report ID: ${session.id}`, 14, 30);
  doc.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 14, 35);

  // Patient Info Section (Placeholder)
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Assessment Overview', 14, 50);
  doc.setLineWidth(0.5);
  doc.line(14, 52, 196, 52);

  const overviewData = [
    ['Session Date', dateStr],
    ['Duration', `${session.duration.toFixed(2)} seconds`],
    ['Data Points', `${session.data.length} samples`],
    ['Device Type', session.data[0]?.fsr > 0 ? 'Neuro Pen (9-Axis + FSR)' : 'Mobile Sensors (IMU Only)']
  ];

  (doc as any).autoTable({
    startY: 55,
    head: [['Metric', 'Value']],
    body: overviewData,
    theme: 'striped',
    headStyles: { fillColor: [16, 185, 129] }
  });

  // Clinical Results
  const currentY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.text('Clinical Findings', 14, currentY);
  doc.setLineWidth(0.5);
  doc.line(14, currentY + 2, 196, currentY + 2);

  const findingsData = [
    ['Tremor Intensity', session.severity],
    ['Clinical Stage', session.stage],
    ['RMS Tremor (G-Force)', session.rms.toFixed(4)],
    ['Dominant Frequency', `${session.frequency.toFixed(2)} Hz`]
  ];

  (doc as any).autoTable({
    startY: currentY + 5,
    head: [['Clinical Metric', 'Assessment Result']],
    body: findingsData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] } // Blue 500
  });

  // Interpretation
  const interpretationY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.text('Interpretation & Notes', 14, interpretationY);
  doc.setLineWidth(0.5);
  doc.line(14, interpretationY + 2, 196, interpretationY + 2);

  doc.setFontSize(10);
  let interpretation = '';
  if (session.stage === 'Stage 3') {
    interpretation = 'Severe tremor detected. Significant impact on motor control observed. Immediate clinical review recommended.';
  } else if (session.stage === 'Stage 2') {
    interpretation = 'Moderate tremor detected. Noticeable during rest or action. Consistent monitoring advised.';
  } else if (session.stage === 'Stage 1') {
    interpretation = 'Mild tremor detected. Often task-specific. Early-stage indicators present.';
  } else {
    interpretation = 'No significant tremor detected. Baseline readings within normal physiological range.';
  }

  doc.text(interpretation, 14, interpretationY + 10, { maxWidth: 180 });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      'This report is generated for informational purposes and should be reviewed by a qualified medical professional.',
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  doc.save(fileName);
};
