import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class WebsitePage extends StatefulWidget {
  const WebsitePage({super.key});

  @override
  State<WebsitePage> createState() => _WebsitePageState();
}

class _WebsitePageState extends State<WebsitePage> {
  static const Color _coverColor = Color(0xFF050309);
  bool _splashLoaded = false;

  // واجهة React (التابات + الشريط + الإعدادات)
  late final WebViewController _homeController;

  // كل تاب موقع له WebView حقيقي (المفتاح = id التاب في React)
  final Map<int, WebViewController> _siteControllers = {};
  final Set<int> _failedIds = {};

  // مكان منطقة المحتوى اللي React بيبعته
  Rect _bounds = Rect.zero;
  int? _visibleId;

  @override
  void initState() {
    super.initState();
    _homeController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(_coverColor)
      ..addJavaScriptChannel(
        'AxiomBridge',
        onMessageReceived: (JavaScriptMessage m) => _onBridgeMessage(m.message),
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) => _hideSplash(),
          onWebResourceError: (_) => _hideSplash(),
          onNavigationRequest: (NavigationRequest request) {
            if (request.url.startsWith('http')) {
              _sendToWeb({'type': 'openUrl', 'url': request.url});
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadFlutterAsset('assets/web/index.html');
  }

  void _hideSplash() {
    if (!mounted || _splashLoaded) return;
    setState(() => _splashLoaded = true);
  }

  // ---------- Flutter -> React ----------
  void _sendToWeb(Map<String, dynamic> data) {
    if (!mounted) return;
    _homeController.runJavaScript(
      'window.__axiomNative && window.__axiomNative(${jsonEncode(data)});',
    );
  }

  // ---------- React -> Flutter ----------
  double _num(dynamic v) => (v as num?)?.toDouble() ?? 0;

  void _onBridgeMessage(String raw) {
    Map<String, dynamic> msg;
    try {
      msg = jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return;
    }

    final int? id = (msg['id'] as num?)?.toInt();

    switch (msg['type']) {
      case 'bounds':
        final rect = Rect.fromLTWH(
          _num(msg['left']),
          _num(msg['top']),
          _num(msg['width']),
          _num(msg['height']),
        );
        if (rect != _bounds && mounted) setState(() => _bounds = rect);
        break;
      case 'show':
        if (mounted) setState(() => _visibleId = id);
        break;
      case 'load':
        if (id != null) _loadInTab(id, (msg['url'] as String?) ?? '');
        break;
      case 'close':
        if (id != null) _closeTab(id);
        break;
      case 'back':
        if (id != null) _siteControllers[id]?.goBack();
        break;
      case 'forward':
        if (id != null) _siteControllers[id]?.goForward();
        break;
      case 'reload':
        if (id != null) _siteControllers[id]?.reload();
        break;
      case 'stop':
        if (id != null) _siteControllers[id]?.runJavaScript('window.stop();');
        break;
    }
  }

  void _closeTab(int id) {
    if (!mounted) return;
    setState(() {
      _siteControllers.remove(id);
      _failedIds.remove(id);
      if (_visibleId == id) _visibleId = null;
    });
  }

  Future<void> _reportNavFlags(int id) async {
    final c = _siteControllers[id];
    if (c == null) return;
    final back = await c.canGoBack();
    final forward = await c.canGoForward();
    _sendToWeb({
      'type': 'state',
      'id': id,
      'canGoBack': back,
      'canGoForward': forward,
    });
  }

  Future<void> _reportFinished(int id, String url) async {
    final c = _siteControllers[id];
    if (c == null) return;

    final back = await c.canGoBack();
    final forward = await c.canGoForward();

    // لو التحميل فشل، متسجليش عنوان صفحة الخطأ بتاعة أندرويد
    if (_failedIds.contains(id)) {
      _sendToWeb({
        'type': 'state',
        'id': id,
        'loading': false,
        'canGoBack': back,
        'canGoForward': forward,
      });
      return;
    }

    final rawTitle = (await c.getTitle())?.trim() ?? '';
    final host = Uri.tryParse(url)?.host ?? '';
    final title = rawTitle.isEmpty ? host : rawTitle;

    _sendToWeb({
      'type': 'state',
      'id': id,
      'loading': false,
      'url': url,
      'title': title,
      'canGoBack': back,
      'canGoForward': forward,
      if (host.isNotEmpty)
        'favicon': 'https://www.google.com/s2/favicons?domain=$host&sz=64',
    });
  }

  /// بيفتح/بيحمّل موقع في WebView التاب ده (وبيعمله لو مش موجود)
  void _loadInTab(int id, String url) {
    if (url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;

    _failedIds.remove(id);

    final existing = _siteControllers[id];
    if (existing != null) {
      existing.loadRequest(uri);
      return;
    }

    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String pageUrl) {
            _failedIds.remove(id);
            _sendToWeb({
              'type': 'state',
              'id': id,
              'loading': true,
              'url': pageUrl,
            });
          },
          onUrlChange: (UrlChange change) {
            final u = change.url;
            if (u == null) return;
            _sendToWeb({'type': 'state', 'id': id, 'url': u});
            _reportNavFlags(id);
          },
          onPageFinished: (String pageUrl) => _reportFinished(id, pageUrl),
          onWebResourceError: (WebResourceError error) {
            if (error.isForMainFrame != true) return;
            _failedIds.add(id);
            _sendToWeb({
              'type': 'state',
              'id': id,
              'loading': false,
              'error': error.description.replaceFirst('net::', ''),
            });
          },
          onNavigationRequest: (NavigationRequest request) {
            final scheme = Uri.tryParse(request.url)?.scheme ?? '';
            const allowed = {'http', 'https', 'about', 'data', 'blob'};
            return allowed.contains(scheme)
                ? NavigationDecision.navigate
                : NavigationDecision.prevent;
          },
        ),
      )
      ..loadRequest(uri);

    if (!mounted) return;
    setState(() => _siteControllers[id] = controller);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            // واجهة React
            WebViewWidget(
              key: const ValueKey('home'),
              controller: _homeController,
            ),

            // مواقع التابات فوق منطقة المحتوى
            if (!_bounds.isEmpty)
              for (final entry in _siteControllers.entries)
                Positioned.fromRect(
                  rect: _bounds,
                  child: Offstage(
                    offstage: entry.key != _visibleId,
                    child: WebViewWidget(
                      key: ValueKey('site-${entry.key}'),
                      controller: entry.value,
                    ),
                  ),
                ),

            // غطاء السبلاش
            Positioned.fill(
              child: IgnorePointer(
                ignoring: _splashLoaded,
                child: AnimatedOpacity(
                  opacity: _splashLoaded ? 0.0 : 1.0,
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