import 'package:flutter/material.dart';

/// Equivalent of the CSS variables in App.css (:root).
class AxiomColors {
  static const bgTop = Color(0xFF14203A);
  static const bgBottom = Color(0xFF24305F);
  static final surface = Colors.white.withOpacity(0.07);
  static final surfaceHover = Colors.white.withOpacity(0.13);
  static final surfaceActive = Colors.white.withOpacity(0.20);
  static final border = Colors.white.withOpacity(0.14);
  static const text = Color(0xFFF2F5FA);
  static final textMuted = const Color(0xFFF2F5FA).withOpacity(0.68);
  static const accent = Color(0xFFA78BFA);
  static const accentHover = Color(0xFFC4B5FD);
  static const danger = Color(0xFFE5484D);
  static const radius = 12.0;
}
