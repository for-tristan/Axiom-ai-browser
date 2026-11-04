import 'dart:math';
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
  static const double _explodeStartMs = 2700; // وقت بداية الانفجار

  late final AnimationController _controller;
  late final Random _rng;

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
  late final Animation<double> _bgGlow;
  late final Animation<double> _fadeOut;

  // بيانات كل حرف (للانفجار)
  final List<_Letter> _letters = [];

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
    _rng = Random(42); // seed ثابت عشان الحركة تتكرر بنفس الشكل

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

    // الخروج: النص يتبلور ويختفي، الشعار بينفجر والحروف تتنطط
    _labelExit = _anim(1.0, 0.0, 2700, 2950, Curves.easeIn);
    _labelBlurOut = _anim(0.0, 8.0, 2700, 2950, Curves.easeIn);
    _bgGlow = _anim(1.0, 0.0, 3200, 3800, Curves.easeIn);
    _fadeOut = _anim(1.0, 0.0, 3700, 3900, Curves.easeIn);

    // جهّز بيانات الحروف (velocity + دوران عشوائي لكل حرف)
    _initLetters();

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

  /// جهّز كل حرف بموقع ابتدائي + سرعة عشوائية + سرعة دوران
  void _initLetters() {
    final int count = _logoText.length;
    final double spacing = 0.10; // المسافة بين مراكز الحروف (نسبة من عرض الشاشة)

    for (int i = 0; i < count; i++) {
      final double initialX = (i - (count - 1) / 2) * spacing;

      // اتجاه عشوائي + سرعة عشوائية
      final double angle = _rng.nextDouble() * 2 * pi;
      final double speed = 350 + _rng.nextDouble() * 250; // 350-600 px/s
      double vx = cos(angle) * speed;
      double vy = sin(angle) * speed - 300; // ميل لأعلى في الأول

      // دوران عشوائي
      final double angularVel = (_rng.nextDouble() - 0.5) * 6; // ±3 rad/s

      _letters.add(_Letter(
        char: _logoText[i],
        initialOffsetFraction: Offset(initialX, 0),
        velocity: Offset(vx, vy),
        angularVelocity: angularVel,
      ));
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  // حرف واحد بنفس ألوان الـ glitch (سماوي/ماجنتا/أبيض)
  Widget _glitchChar(String char, double fontSize,
      {double glow = 1.0, double offset = 3}) {
    TextStyle style(Color color, List<Shadow> shadows) => TextStyle(
      fontSize: fontSize,
      fontWeight: FontWeight.w900,
      fontStyle: FontStyle.italic,
      letterSpacing: 0,
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
            char,
            style: style(_cyan, [
              Shadow(
                  color: _cyan.withOpacity(0.8 * glow),
                  blurRadius: fontSize * 0.3),
            ]),
          ),
        ),
        Transform.translate(
          offset: Offset(offset, offset * 0.5),
          child: Text(
            char,
            style: style(_magenta, [
              Shadow(
                  color: _magenta.withOpacity(0.8 * glow),
                  blurRadius: fontSize * 0.3),
            ]),
          ),
        ),
        Text(
          char,
          style: style(Colors.white, [
            Shadow(
                color: Colors.white.withOpacity(0.6 * glow),
                blurRadius: fontSize * 0.12),
          ]),
        ),
      ],
    );
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
                  blurRadius: fontSize * 0.3),
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
                  blurRadius: fontSize * 0.3),
            ]),
          ),
        ),
        Text(
          text,
          style: style(Colors.white, [
            Shadow(
                color: Colors.white.withOpacity(0.6 * glow),
                blurRadius: fontSize * 0.12),
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

  /// احسب موقع حرف واحد في لحظة t (ثانية من بداية الانفجار).
  /// الأصل (0,0) هو مركز الشعار المجمّع. الارتداد يتم على حدود الشاشة.
  _LetterPos _computeLetterPos(
      _Letter letter,
      double t,
      Size screenSize,
      double logoCenterY,
      ) {
    final double initialX = letter.initialOffsetFraction.dx * screenSize.width;
    const double initialY = 0;

    if (t <= 0) {
      return _LetterPos(offset: Offset(initialX, initialY), angle: 0);
    }

    const double dt = 0.016; // خطوة 16ms
    final int steps = (t / dt).floor();
    final double remainder = t - steps * dt;

    double x = initialX;
    double y = initialY;
    double vx = letter.velocity.dx;
    double vy = letter.velocity.dy;
    double angle = 0;

    const double gravity = 700; // جاذبية لأسفل
    final double letterHalfW = screenSize.width * 0.07;
    final double letterHalfH = screenSize.width * 0.10;

    // حدود الشاشة بالنسبة لمركز الشعار
    final double leftBound = -screenSize.width / 2 + letterHalfW;
    final double rightBound = screenSize.width / 2 - letterHalfW;
    final double topBound = -logoCenterY + letterHalfH;
    final double bottomBound =
        screenSize.height - logoCenterY - letterHalfH;

    void step(double d) {
      x += vx * d;
      y += vy * d;
      vy += gravity * d;
      angle += letter.angularVelocity * d;

      // ارتداد أفقي (يسار/يمين)
      if (x < leftBound) {
        x = leftBound;
        vx = -vx * 0.85;
      } else if (x > rightBound) {
        x = rightBound;
        vx = -vx * 0.85;
      }

      // ارتداد رأسي (أعلى/أسفل)
      if (y > bottomBound) {
        y = bottomBound;
        vy = -vy * 0.7;
        vx *= 0.92; // احتكاك مع الأرض
      } else if (y < topBound) {
        y = topBound;
        vy = -vy * 0.85;
      }
    }

    for (int i = 0; i < steps; i++) {
      step(dt);
    }
    if (remainder > 0) {
      step(remainder);
    }

    return _LetterPos(offset: Offset(x, y), angle: angle);
  }

  @override
  Widget build(BuildContext context) {
    final Size size = MediaQuery.of(context).size;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final double progressMs = _controller.value * _totalMs;
        final bool isExploding = progressMs >= _explodeStartMs;
        final double t =
        isExploding ? (progressMs - _explodeStartMs) / 1000 : 0;

        final double fontSize = size.width * 0.17;
        final double labelFontSize = size.width * 0.07;

        // احسب مركز الشعار على الشاشة (يطابق تخطيط Column الأصلي)
        final double columnHeight =
            fontSize + 14 + labelFontSize + 14 + 2;
        final double logoCenterY =
            size.height / 2 - columnHeight / 2 + fontSize / 2;

        return Scaffold(
          backgroundColor: _bgBase,
          body: Stack(
            fit: StackFit.expand,
            children: [
              Opacity(
                opacity: _bgGlow.value.clamp(0.0, 1.0),
                child: _buildBackground(),
              ),

              if (!isExploding)
              // === قبل الانفجار: الشعار مجمع + النص + الخط ===
                Opacity(
                  opacity: _fadeOut.value.clamp(0.0, 1.0),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Transform.translate(
                          offset: Offset(0, _introShift.value * size.height),
                          child: Transform.scale(
                            scale: _introScale.value,
                            child: _glitchText(
                              _logoText,
                              fontSize,
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
                )
              else
              // === أثناء الانفجار: الحروف تطير وتتنطط ===
                Opacity(
                  opacity: _fadeOut.value.clamp(0.0, 1.0),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      // النص الصغير + الخط (بيختفوا بالـ blur)
                      Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SizedBox(height: fontSize + 14),
                            _buildLabel(size.width),
                            const SizedBox(height: 14),
                            _buildLine(),
                          ],
                        ),
                      ),
                      // الحروف المتنططة
                      ..._letters.map((letter) {
                        final _LetterPos pos =
                        _computeLetterPos(letter, t, size, logoCenterY);
                        return Positioned(
                          left: size.width / 2 + pos.offset.dx,
                          top: logoCenterY + pos.offset.dy,
                          child: FractionalTranslation(
                            translation: const Offset(-0.5, -0.5),
                            child: Transform.rotate(
                              angle: pos.angle,
                              child: _glitchChar(
                                letter.char,
                                fontSize,
                                glow: 1.0,
                              ),
                            ),
                          ),
                        );
                      }),
                    ],
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

/// بيانات حرف واحد
class _Letter {
  final String char;
  final Offset initialOffsetFraction; // نسبة من عرض الشاشة
  final Offset velocity; // px/s
  final double angularVelocity; // rad/s

  _Letter({
    required this.char,
    required this.initialOffsetFraction,
    required this.velocity,
    required this.angularVelocity,
  });
}

/// موقع + زاوية حرف في لحظة معينة
class _LetterPos {
  final Offset offset;
  final double angle;

  _LetterPos({required this.offset, required this.angle});
}
