import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'utils.dart';

class BrowserTab {
  final int id;
  String title;
  bool active;
  final WebViewController? webController;
  String currentUrl;
  bool isHome;

  BrowserTab({
    required this.id,
    required this.title,
    required this.active,
    this.webController,
    this.currentUrl = '',
    this.isHome = true,
  });

  BrowserTab copyWith({bool? active, String? title, String? currentUrl, bool? isHome}) =>
      BrowserTab(
        id: id,
        title: title ?? this.title,
        active: active ?? this.active,
        webController: webController,
        currentUrl: currentUrl ?? this.currentUrl,
        isHome: isHome ?? this.isHome,
      );
}

class WebsitePage extends StatefulWidget {
  const WebsitePage({super.key});

  @override
  State<WebsitePage> createState() => _WebsitePageState();
}

class _WebsitePageState extends State<WebsitePage> {
  static const Color _coverColor = Color(0xFF050309);
  bool _splashLoaded = false;

  List<BrowserTab> _tabs = [];

  // كل تاب هوم له controller واحد بيتعمل مرة واحدة (علشان الصفحة ما تتعملش reload كل ما الشاشة تتحدث)
  final Map<int, WebViewController> _homeControllers = {};

  @override
  void initState() {
    super.initState();
    _tabs = [
      BrowserTab(
        id: DateTime.now().millisecondsSinceEpoch,
        title: 'Axiom Home',
        active: true,
        isHome: true,
      ),
    ];
  }

  void _hideSplash() {
    if (!mounted || _splashLoaded) return;
    setState(() => _splashLoaded = true);
  }

  /// بيفتح أي موقع في تاب WebView جديد
  void _openWebsiteInNewTab(String rawUrl, {String title = 'Loading...'}) {
    final formattedUrl = getSearchUrl(rawUrl);
    if (formattedUrl.isEmpty) return;

    final newId = DateTime.now().millisecondsSinceEpoch;
    late final WebViewController siteController;

    siteController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(_coverColor)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (String url) async {
            final pageTitle = await siteController.getTitle() ?? title;
            if (!mounted) return;

            setState(() {
              final idx = _tabs.indexWhere((t) => t.id == newId);
              if (idx != -1) {
                _tabs[idx].title = pageTitle;
                _tabs[idx].currentUrl = url;
              }
            });
          },
          onWebResourceError: (_) => _hideSplash(),
        ),
      )
      ..loadRequest(Uri.parse(formattedUrl));

    setState(() {
      _tabs = [
        ..._tabs.map((t) => t.copyWith(active: false)),
        BrowserTab(
          id: newId,
          title: title,
          active: true,
          webController: siteController,
          currentUrl: formattedUrl,
          isHome: false,
        ),
      ];
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            IndexedStack(
              index: _tabs.indexWhere((t) => t.active),
              children: [
                for (final tab in _tabs)
                  tab.isHome
                      ? _buildLocalHomeWidget(tab)
                      : WebViewWidget(
                    key: ValueKey('site-${tab.id}'),
                    controller: tab.webController!,
                  ),
              ],
            ),
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

  Widget _buildLocalHomeWidget(BrowserTab tab) {
    final WebViewController homeController = _homeControllers.putIfAbsent(
      tab.id,
          () => WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(_coverColor)
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageFinished: (_) => _hideSplash(),
            onWebResourceError: (_) => _hideSplash(),
            onNavigationRequest: (NavigationRequest request) {
              if (request.url.startsWith('http')) {
                _openWebsiteInNewTab(request.url);
                return NavigationDecision.prevent;
              }
              return NavigationDecision.navigate;
            },
          ),
        )
        ..loadFlutterAsset('assets/web/index.html'),
    );

    return WebViewWidget(
      key: ValueKey('home-${tab.id}'),
      controller: homeController,
    );
  }
}