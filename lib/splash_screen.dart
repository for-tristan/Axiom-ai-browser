import 'dart:ui';
import 'package:flutter/material.dart';
import 'website_page.dart';

// ======= غيّر النصوص من هنا فقط =======
const String _logoText = 'AXIOM'; // الشعار الكبير
const String _labelText = 'AXIOM'; // النص الصغير تحت الشعار
// ======================================

const Color _cyan = Color(0xFF00E5FF);
const Color _magenta = Color(0xFFD81FB5);
const Color _bgBase = Color(0xFF050309);

class Splash_screen extends StatefulWidget {
  const Splash_screen({super.key});

  @override
  State<Splash_screen> createState() => _Splash_screenState();
}

class _Splash_screenState extends State<Splash_screen>
    with SingleTickerProviderStateMixin {
  static const double _totalMs = 3900;

  late final AnimationController _controller;

  // دخول الشعار
  late final Animation<double> _introScale;
  late final Animation<double> _introShift;
  late final Animation<double> _glow;

  // النص الصغير (ظهور بالبلور)
  late final Animation<double> _labelReveal;
  late final Animation<double> _labelBlurIn;
  late final Animation<double> _lineGrow;

  // الخروج
  late final Animation<double> _labelExit;
  late final Animation<double> _labelBlurOut;
  late final Animation<double> _dipScale;
  late final Animation<double> _zoomScale;
  late final Animation<double> _bgGlow;
  late final Animation<double> _fadeOut;

  Animation<double> _anim(
      double begin,
      double end,
      double startMs,
      double endMs,
      Curve curve,
      ) {
    return Tween<double>(begin: begin, end: end).animate(
      CurvedAnimation(
        parent: _controller,
        curve: Interval(startMs / _totalMs, endMs / _totalMs, curve: curve),
      ),
    );
  }

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3900),
    );

    // دخول: الشعار يبدأ أكبر شوية وأنزل ثم يستقر لفوق
    _introScale = _anim(1.15, 1.0, 0, 700, Curves.easeOutCubic);
    _introShift = _anim(0.05, 0.0, 0, 700, Curves.easeOutCubic);
    _glow = _anim(1.2, 0.8, 0, 900, Curves.easeOut);

    // النص الصغير يظهر من بلور إلى وضوح + الخط الرفيع يكبر
    _labelReveal = _anim(0.0, 1.0, 300, 700, Curves.easeOut);
    _labelBlurIn = _anim(9.0, 0.0, 300, 800, Curves.easeOut);
    _lineGrow = _anim(0.0, 1.0, 500, 1000, Curves.easeOut);

    // الخروج: النص يتبلور ويختفي، الشعار ينكمش شوية ثم Zoom ضخم
    _labelExit = _anim(1.0, 0.0, 2700, 2950, Curves.easeIn);
    _labelBlurOut = _anim(0.0, 8.0, 2700, 2950, Curves.easeIn);
    _dipScale = _anim(1.0, 0.92, 2700, 2900, Curves.easeInOut);
    _zoomScale = _anim(1.0, 50.0, 2850, 3600, Curves.easeInCubic);
    _bgGlow = _anim(1.0, 0.0, 3200, 3650, Curves.easeIn);
    _fadeOut = _anim(1.0, 0.0, 3450, 3750, Curves.easeIn);

    _controller.forward();

    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        if (!mounted) return;
        Navigator.pushReplacement(
          context,
          PageRouteBuilder(
            pageBuilder: (context, animation, secondaryAnimation) =>
            const WebsitePage(),
            transitionsBuilder:
                (context, animation, secondaryAnimation, child) {
              return FadeTransition(opacity: animation, child: child);
            },
            transitionDuration: const Duration(milliseconds: 500),
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  // نص أبيض عريض مع حواف سماوي (يسار) وماجنتا (يمين) + توهج
  Widget _glitchText(
      String text,
      double fontSize, {
        double letterSpacing = 2,
        double offset = 3,
        double glow = 1.0,
      }) {
    TextStyle style(Color color, List<Shadow> shadows) => TextStyle(
      fontSize: fontSize,
      fontWeight: FontWeight.w900,
      fontStyle: FontStyle.italic,
      letterSpacing: letterSpacing,
      height: 1,
      color: color,
      shadows: shadows,
    );

    return Stack(
      alignment: Alignment.center,
      children: [
        Transform.translate(
          offset: Offset(-offset, offset * 0.5),
          child: Text(
            text,
            style: style(_cyan, [
              Shadow(
                color: _cyan.withOpacity(0.8 * glow),
                blurRadius: fontSize * 0.3,
              ),
            ]),
          ),
        ),
        Transform.translate(
          offset: Offset(offset, offset * 0.5),
          child: Text(
            text,
            style: style(_magenta, [
              Shadow(
                color: _magenta.withOpacity(0.8 * glow),
                blurRadius: fontSize * 0.3,
              ),
            ]),
          ),
        ),
        Text(
          text,
          style: style(Colors.white, [
            Shadow(
              color: Colors.white.withOpacity(0.6 * glow),
              blurRadius: fontSize * 0.12,
            ),
          ]),
        ),
      ],
    );
  }

  Widget _buildBackground() {
    return Stack(
      fit: StackFit.expand,
      children: [
        // توهج سماوي غامق من فوق
        Container(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: const Alignment(-0.3, -0.85),
              radius: 0.95,
              colors: [
                const Color(0xFF0A3A44).withOpacity(0.55),
                Colors.transparent,
              ],
            ),
          ),
        ),
        // توهج بنفسجي/ماجنتا من تحت
        Container(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: const Alignment(0.2, 1.0),
              radius: 0.95,
              colors: [
                const Color(0xFF3A0B3F).withOpacity(0.5),
                Colors.transparent,
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLabel(double width) {
    final double blur = _labelBlurIn.value > _labelBlurOut.value
        ? _labelBlurIn.value
        : _labelBlurOut.value;

    Widget text = _glitchText(
      _labelText,
      width * 0.07,
      letterSpacing: 1,
      offset: 1.2,
      glow: 0.3,
    );

    if (blur > 0.05) {
      text = ImageFiltered(
        imageFilter: ImageFilter.blur(
          sigmaX: blur,
          sigmaY: blur,
          tileMode: TileMode.decal,
        ),
        child: text,
      );
    }

    return Opacity(
      opacity: (_labelReveal.value * _labelExit.value).clamp(0.0, 1.0),
      child: text,
    );
  }

  Widget _buildLine() {
    return Opacity(
      opacity: (_lineGrow.value * _labelExit.value).clamp(0.0, 1.0),
      child: Container(
        width: 70 * _lineGrow.value,
        height: 2,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          gradient: LinearGradient(
            colors: [
              Colors.transparent,
              _cyan.withOpacity(0.9),
              _magenta.withOpacity(0.9),
              Colors.transparent,
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final Size size = MediaQuery.of(context).size;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final double scale =
            _introScale.value * _dipScale.value * _zoomScale.value;

        return Scaffold(
          backgroundColor: _bgBase,
          body: Stack(
            fit: StackFit.expand,
            children: [
              Opacity(
                opacity: _bgGlow.value.clamp(0.0, 1.0),
                child: _buildBackground(),
              ),
              Opacity(
                opacity: _fadeOut.value.clamp(0.0, 1.0),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Transform.translate(
                        offset: Offset(0, _introShift.value * size.height),
                        child: Transform.scale(
                          scale: scale,
                          child: _glitchText(
                            _logoText,
                            size.width * 0.17,
                            letterSpacing: 2,
                            offset: 3,
                            glow: _glow.value,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      _buildLabel(size.width),
                      const SizedBox(height: 14),
                      _buildLine(),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}