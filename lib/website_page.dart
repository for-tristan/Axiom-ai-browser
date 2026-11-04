import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'bookmarks_page.dart';
import 'browser_store.dart';
import 'history_page.dart';
import 'profile_page.dart';
import 'theme.dart';
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

  final TextEditingController _addressController = TextEditingController();
  List<BrowserTab> _tabs = [];

  // التاريخ والمحفوظات والبروفايل
  final BrowserStore _store = BrowserStore.instance;

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
    _store.init();
    _store.addListener(_onStoreChanged);
  }

  void _onStoreChanged() {
    if (mounted) setState(() {});
  }

  void _hideSplash() {
    if (!mounted || _splashLoaded) return;
    setState(() => _splashLoaded = true);
  }

  @override
  void dispose() {
    _store.removeListener(_onStoreChanged);
    _addressController.dispose();
    super.dispose();
  }

  void _handleAddNewTab() {
    final newId = DateTime.now().millisecondsSinceEpoch;
    setState(() {
      _tabs = [
        ..._tabs.map((t) => t.copyWith(active: false)),
        BrowserTab(
          id: newId,
          title: 'New Tab',
          active: true,
          isHome: true,
        ),
      ];
      _addressController.clear();
    });
  }

  void _handleSelectTab(int id) {
    setState(() {
      _tabs = _tabs.map((t) {
        final isActive = t.id == id;
        if (isActive) {
          _addressController.text = t.isHome ? '' : t.currentUrl;
        }
        return t.copyWith(active: isActive);
      }).toList();
    });
  }

  void _handleCloseTab(int id) {
    if (_tabs.length == 1) {
      setState(() {
        _tabs[0] = BrowserTab(
          id: _tabs[0].id,
          title: 'Axiom Home',
          active: true,
          isHome: true,
        );
        _addressController.clear();
      });
      return;
    }

    final index = _tabs.indexWhere((t) => t.id == id);
    List<BrowserTab> filtered = _tabs.where((t) => t.id != id).toList();

    if (_tabs[index].active && filtered.isNotEmpty) {
      int newActiveIndex = index > 0 ? index - 1 : 0;
      filtered[newActiveIndex] = filtered[newActiveIndex].copyWith(active: true);
      _addressController.text = filtered[newActiveIndex].isHome ? '' : filtered[newActiveIndex].currentUrl;
    }

    _homeControllers.remove(id);
    setState(() => _tabs = filtered);
  }

  BrowserTab get _activeTab => _tabs.firstWhere((t) => t.active, orElse: () => _tabs.first);

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

            // نسجل الصفحة في التاريخ
            _store.addHistory(url, pageTitle);

            setState(() {
              final idx = _tabs.indexWhere((t) => t.id == newId);
              if (idx != -1) {
                _tabs[idx].title = pageTitle;
                _tabs[idx].currentUrl = url;
                if (_tabs[idx].active) {
                  _addressController.text = url;
                }
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
      _addressController.text = formattedUrl;
    });
  }

  void _goHome() {
    setState(() {
      final active = _activeTab;
      active.isHome = true;
      active.title = 'Axiom Home';
      active.currentUrl = '';
      _addressController.clear();
    });
  }

  Future<void> _handleBack() async {
    final active = _activeTab;
    if (active.isHome || active.webController == null) return;

    if (await active.webController!.canGoBack()) {
      await active.webController!.goBack();
    } else {
      _goHome();
    }
  }

  Future<void> _handleForward() async {
    final active = _activeTab;
    if (active.isHome || active.webController == null) return;
    if (await active.webController!.canGoForward()) {
      await active.webController!.goForward();
    }
  }

  Future<void> _handleReload() async {
    final active = _activeTab;
    if (!active.isHome && active.webController != null) {
      await active.webController!.reload();
    }
  }

  // ---------------------------------------------------------------------------
  // الصفحات الجديدة: History / Bookmarks / Profile + زرار الحفظ
  // ---------------------------------------------------------------------------

  /// الرسائل اللي جاية من الشريط الجانبي في واجهة React
  void _handleHostMessage(String message) {
    if (!mounted) return;
    switch (message) {
      case 'history':
        _openHistory();
        break;
      case 'bookmarks':
        _openBookmarks();
        break;
      case 'profile':
        _openProfile();
        break;
    }
  }

  Future<void> _openHistory() async {
    final String? url = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const HistoryPage()),
    );
    if (url != null && mounted) {
      _openWebsiteInNewTab(url);
    }
  }

  Future<void> _openBookmarks() async {
    final String? url = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const BookmarksPage()),
    );
    if (url != null && mounted) {
      _openWebsiteInNewTab(url);
    }
  }

  Future<void> _openProfile() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => const ProfilePage()),
    );
  }

  void _toggleBookmark() {
    final tab = _activeTab;
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();

    if (tab.isHome || tab.currentUrl.isEmpty) {
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Open a page first to save it'),
          duration: Duration(seconds: 2),
        ),
      );
      return;
    }

    final bool saved = _store.toggleBookmark(tab.currentUrl, tab.title);
    messenger.showSnackBar(
      SnackBar(
        content: Text(saved ? 'Page saved' : 'Removed from saved'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                _buildChromeTabsRow(), // شريط التابات العلوي الوحيد
                _buildNavigationBar(), // شريط التنقل العلوي الوحيد
                Expanded(
                  child: IndexedStack(
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
        ..addJavaScriptChannel(
          'AxiomHost',
          onMessageReceived: (JavaScriptMessage message) {
            _handleHostMessage(message.message);
          },
        )
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

  Widget _buildChromeTabsRow() {
    return Container(
      height: 42,
      color: Colors.black.withValues(alpha: 0.5),
      child: Row(
        children: [
          Expanded(
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
              children: [
                for (final tab in _tabs)
                  Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: InkWell(
                      onTap: () => _handleSelectTab(tab.id),
                      child: Container(
                        width: 145,
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        decoration: BoxDecoration(
                          color: tab.active ? AxiomColors.surfaceActive : AxiomColors.surface,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
                          border: Border.all(color: AxiomColors.border),
                        ),
                        child: Row(
                          children: [
                            // النجمة بتظهر مكان أيقونة الموقع لو التاب ده محفوظ
                            if (!tab.isHome && _store.isBookmarked(tab.currentUrl))
                              const Icon(Icons.star, size: 12, color: AxiomColors.accent)
                            else
                              const Icon(Icons.public, size: 12, color: Colors.white70),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                tab.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: tab.active ? Colors.white : Colors.white60,
                                ),
                              ),
                            ),
                            InkWell(
                              onTap: () => _handleCloseTab(tab.id),
                              child: const Icon(Icons.close, size: 14, color: Colors.white60),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.add, size: 20, color: Colors.white),
            tooltip: 'New Tab',
            onPressed: _handleAddNewTab,
          ),
        ],
      ),
    );
  }

  Widget _buildNavigationBar() {
    final active = _activeTab;
    final bool saved = !active.isHome && _store.isBookmarked(active.currentUrl);

    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      color: Colors.black.withValues(alpha: 0.3),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.home, size: 18, color: Colors.white),
            onPressed: _goHome,
            tooltip: 'Home',
          ),
          IconButton(
            icon: const Icon(Icons.arrow_back, size: 18, color: Colors.white),
            onPressed: _handleBack,
            tooltip: 'Back',
          ),
          IconButton(
            icon: const Icon(Icons.arrow_forward, size: 18, color: Colors.white),
            onPressed: _handleForward,
            tooltip: 'Forward',
          ),
          IconButton(
            icon: const Icon(Icons.refresh, size: 18, color: Colors.white),
            onPressed: _handleReload,
            tooltip: 'Reload',
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              height: 36,
              padding: const EdgeInsets.only(left: 12, right: 4),
              decoration: BoxDecoration(
                color: AxiomColors.surface,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AxiomColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _addressController,
                      style: const TextStyle(fontSize: 14, color: Colors.white),
                      textInputAction: TextInputAction.go,
                      onSubmitted: (value) {
                        if (value.trim().isNotEmpty) {
                          if (_activeTab.isHome) {
                            _openWebsiteInNewTab(value, title: value);
                          } else {
                            _activeTab.webController?.loadRequest(Uri.parse(getSearchUrl(value)));
                          }
                        }
                      },
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        hintText: 'Search or enter address...',
                        hintStyle: TextStyle(color: Colors.white54),
                        isDense: true,
                      ),
                    ),
                  ),
                  // زرار حفظ الصفحة (نجمة)
                  InkWell(
                    onTap: _toggleBookmark,
                    borderRadius: BorderRadius.circular(18),
                    child: Padding(
                      padding: const EdgeInsets.all(6),
                      child: Icon(
                        saved ? Icons.star : Icons.star_border,
                        size: 20,
                        color: saved ? AxiomColors.accent : Colors.white70,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
