import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class WebsitePage extends StatefulWidget {
  const WebsitePage({super.key});

  @override
  State<WebsitePage> createState() => _WebsitePageState();
}

class _WebsitePageState extends State<WebsitePage> {
  // نفس لون خلفية السبلاش عشان الانتقال يبقى متصل
  static const Color _coverColor = Color(0xFF050309);

  late final WebViewController controller;
  bool _loaded = false;

  void _hideCover() {
    if (!mounted || _loaded) return;
    setState(() => _loaded = true);
  }

  @override
  void initState() {
    super.initState();

    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(_coverColor)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) => _hideCover(),
          onWebResourceError: (_) => _hideCover(),
        ),
      )
      ..loadFlutterAsset('assets/web/index.html');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            WebViewWidget(controller: controller),

            // غطاء داكن فوق الويب فيو لحد ما الصفحة تخلص تحميل
            Positioned.fill(
              child: IgnorePointer(
                ignoring: _loaded,
                child: AnimatedOpacity(
                  opacity: _loaded ? 0.0 : 1.0,
                  duration: const Duration(milliseconds: 300),
                  child: const ColoredBox(color: _coverColor),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}