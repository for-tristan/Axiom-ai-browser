import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:url_launcher/url_launcher.dart';

import 'answer_page.dart';
import 'theme.dart';
import 'utils.dart';

/// Port of the `Tab` interface in App.tsx.
class BrowserTab {
  final int id;
  final String title;
  final bool active;

  const BrowserTab({required this.id, required this.title, required this.active});

  BrowserTab copyWith({bool? active}) =>
      BrowserTab(id: id, title: title, active: active ?? this.active);
}

class BrowserPage extends StatefulWidget {
  const BrowserPage({super.key});

  @override
  State<BrowserPage> createState() => _BrowserPageState();
}

class _BrowserPageState extends State<BrowserPage> {
  final _queryController = TextEditingController();
  final _addressController = TextEditingController();
  final _speech = stt.SpeechToText();

  bool _isListening = false;
  String _status = '';

  List<BrowserTab> _tabs = const [
    BrowserTab(id: 1, title: 'New Tab', active: true),
  ];

  @override
  void dispose() {
    _queryController.dispose();
    _addressController.dispose();
    _speech.cancel();
    super.dispose();
  }

  // ── Tabs ────────────────────────────────────────────────────────────
  void _handleAddTab() {
    final newId = DateTime.now().millisecondsSinceEpoch;
    setState(() {
      _tabs = [
        ..._tabs.map((t) => t.copyWith(active: false)),
        BrowserTab(id: newId, title: 'New Tab', active: true),
      ];
    });
  }

  void _handleSelectTab(int id) {
    setState(() {
      _tabs = _tabs.map((t) => t.copyWith(active: t.id == id)).toList();
    });
  }

  void _handleCloseTab(int id) {
    if (_tabs.length == 1) return;

    var filtered = _tabs.where((t) => t.id != id).toList();
    final hasActive = filtered.any((t) => t.active);

    if (!hasActive && filtered.isNotEmpty) {
      filtered[filtered.length - 1] =
          filtered.last.copyWith(active: true);
    }
    setState(() => _tabs = filtered);
  }

  // ── Navigation / search ─────────────────────────────────────────────
  Future<void> _open(String url) async {
    final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      setState(() => _status = 'Could not open $url');
    }
  }

  void _handleMainSearch() {
    final url = getSearchUrl(_queryController.text);
    if (url.isEmpty) {
      setState(() => _status = 'Please enter a search term or website address.');
      return;
    }
    setState(() => _status = '');
    _open(url);
  }

  void _handleAddressSearch() {
    final url = getSearchUrl(_addressController.text);
    if (url.isEmpty) return;
    setState(() => _status = '');
    _open(url);
  }

  /// "AI powered search": sends the question to the backend (/search/answer)
  /// and shows the generated answer with citations.
  void _handleAiSearch() {
    final question = _queryController.text.trim();
    if (question.isEmpty) {
      setState(() => _status = 'Type a question first, then tap AI search.');
      return;
    }
    setState(() => _status = '');
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => AnswerPage(question: question)),
    );
  }

  // ── Voice search ────────────────────────────────────────────────────
  Future<void> _startVoiceSearch() async {
    if (_isListening) return;

    try {
      setState(() => _status = 'Checking microphone permission...');

      final available = await _speech.initialize(
        onStatus: (s) {
          if (s == 'done' || s == 'notListening') {
            if (mounted) setState(() => _isListening = false);
          }
        },
        onError: (e) {
          if (mounted) {
            setState(() {
              _isListening = false;
              _status = 'Voice error: ${e.errorMsg}';
            });
          }
        },
      );

      if (!available) {
        setState(() => _status = 'Voice search is not supported on this device.');
        return;
      }

      setState(() {
        _isListening = true;
        _status = 'Listening... Speak now.';
      });

      await _speech.listen(
        localeId: 'ar_EG',
        listenOptions: stt.SpeechListenOptions(partialResults: false),
        onResult: (result) {
          if (!result.finalResult) return;
          final transcript = result.recognizedWords.trim();
          if (transcript.isEmpty) {
            setState(() => _status = 'No speech detected.');
            return;
          }

          _queryController.text = transcript;
          final url = getSearchUrl(transcript);
          if (url.isNotEmpty) {
            setState(() => _status = 'Searching for: $transcript');
            _open(url);
          }
        },
      );
    } catch (_) {
      setState(() {
        _isListening = false;
        _status = 'Could not start voice search.';
      });
    }
  }

  // ── UI ──────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment(-0.34, -1),
            end: Alignment(0.34, 1),
            colors: [AxiomColors.bgTop, AxiomColors.bgBottom],
          ),
        ),
        child: Container(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: const Alignment(0.5, -1),
              radius: 1.1,
              colors: [
                AxiomColors.accent.withOpacity(0.18),
                Colors.transparent,
              ],
              stops: const [0, 0.55],
            ),
          ),
          child: SafeArea(
            child: Column(
              children: [
                _buildTabBar(),
                _buildNavigationBar(),
                Expanded(child: _buildBody()),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      height: 42,
      padding: const EdgeInsets.only(left: 12),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.22),
        border: Border(bottom: BorderSide(color: AxiomColors.border)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            for (final tab in _tabs) ...[
              _TabItem(
                tab: tab,
                onTap: () => _handleSelectTab(tab.id),
                onClose: () => _handleCloseTab(tab.id),
              ),
              const SizedBox(width: 6),
            ],
            Padding(
              padding: const EdgeInsets.only(bottom: 3),
              child: _RoundButton(
                size: 28,
                icon: FontAwesomeIcons.plus,
                iconSize: 12,
                tooltip: 'New Tab',
                color: AxiomColors.textMuted,
                onPressed: _handleAddTab,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNavigationBar() {
    final showTools = MediaQuery.of(context).size.width >= 600;
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        border: Border(bottom: BorderSide(color: AxiomColors.border)),
      ),
      child: Row(
        children: [
          // Back / Forward / Reload (inert in the original too)
          for (final b in const [
            (FontAwesomeIcons.arrowLeft, 'Back'),
            (FontAwesomeIcons.arrowRight, 'Forward'),
            (FontAwesomeIcons.rotateRight, 'Reload'),
          ])
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: _RoundButton(
                size: 34,
                icon: b.$1,
                iconSize: 14,
                tooltip: b.$2,
                onPressed: () {},
              ),
            ),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              height: 36,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: AxiomColors.surface,
                border: Border.all(color: AxiomColors.border),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Row(
                children: [
                  FaIcon(FontAwesomeIcons.lock,
                      size: 12, color: AxiomColors.textMuted),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _addressController,
                      style: const TextStyle(fontSize: 14),
                      textInputAction: TextInputAction.go,
                      keyboardType: TextInputType.url,
                      onSubmitted: (_) => _handleAddressSearch(),
                      decoration: InputDecoration(
                        isDense: true,
                        border: InputBorder.none,
                        hintText: 'Search or enter address...',
                        hintStyle: TextStyle(color: AxiomColors.textMuted),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (showTools) ...[
            const SizedBox(width: 12),
            _RoundButton(
                size: 34,
                icon: FontAwesomeIcons.star,
                iconSize: 14,
                tooltip: 'Bookmarks',
                onPressed: () {}),
            const SizedBox(width: 4),
            _RoundButton(
                size: 34,
                icon: FontAwesomeIcons.puzzlePiece,
                iconSize: 14,
                tooltip: 'Extensions',
                onPressed: () {}),
            const SizedBox(width: 4),
            _RoundButton(
                size: 34,
                icon: FontAwesomeIcons.user,
                iconSize: 14,
                tooltip: 'Profile',
                background: AxiomColors.surface,
                onPressed: () {}),
          ],
        ],
      ),
    );
  }

  Widget _buildBody() {
    final narrow = MediaQuery.of(context).size.width <= 900;
    return Row(
      children: [
        _Sidebar(narrow: narrow),
        Expanded(child: _buildMainContent(narrow)),
      ],
    );
  }

  Widget _buildMainContent(bool narrow) {
    return Stack(
      children: [
        Positioned.fill(
          child: LayoutBuilder(
            builder: (context, c) => SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: c.maxHeight - 48),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'AXIOM BROWSER',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: narrow ? 32 : 44,
                          fontWeight: FontWeight.w500,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text('Search smarter with AI',
                          style: TextStyle(
                              fontSize: 16, color: AxiomColors.textMuted)),
                      const SizedBox(height: 26),
                      _buildSearchBar(),
                      const SizedBox(height: 34),
                      _buildShortcuts(),
                      if (narrow) ...[
                        const SizedBox(height: 28),
                        _buildAiBadge(),
                      ],
                      const SizedBox(height: 56),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        if (_status.isNotEmpty)
          Positioned(
            bottom: 24,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.4),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(_status, style: const TextStyle(fontSize: 13)),
              ),
            ),
          ),
        if (!narrow)
          Positioned(right: 28, bottom: 28, child: _buildAiBadge()),
      ],
    );
  }

  Widget _buildSearchBar() {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 600),
      child: Container(
        height: 58,
        padding: const EdgeInsets.only(left: 20, right: 8),
        decoration: BoxDecoration(
          color: AxiomColors.surface,
          border: Border.all(color: AxiomColors.border),
          borderRadius: BorderRadius.circular(29),
        ),
        child: Row(
          children: [
            _RoundButton(
              size: 32,
              icon: FontAwesomeIcons.wandMagicSparkles,
              iconSize: 16,
              tooltip: 'AI search',
              color: AxiomColors.accent,
              onPressed: _handleAiSearch,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _queryController,
                style: const TextStyle(fontSize: 16),
                textInputAction: TextInputAction.search,
                onSubmitted: (_) => _handleMainSearch(),
                decoration: InputDecoration(
                  border: InputBorder.none,
                  hintText: 'Ask anything...',
                  hintStyle: TextStyle(color: AxiomColors.textMuted),
                ),
              ),
            ),
            _RoundButton(
              size: 40,
              icon: FontAwesomeIcons.microphone,
              iconSize: 16,
              tooltip: 'Voice Search',
              background: _isListening ? AxiomColors.danger : null,
              onPressed: _startVoiceSearch,
            ),
            const SizedBox(width: 12),
            _RoundButton(
              size: 40,
              icon: FontAwesomeIcons.arrowRight,
              iconSize: 16,
              tooltip: 'Search',
              color: AxiomColors.bgTop,
              background: AxiomColors.accent,
              onPressed: _handleMainSearch,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildShortcuts() {
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 22,
      runSpacing: 18,
      children: [
        _Shortcut(
          label: 'YouTube',
          icon: const FaIcon(FontAwesomeIcons.youtube,
              size: 20, color: Color(0xFFFF0000)),
          onTap: () => _open('https://youtube.com'),
        ),
        _Shortcut(
          label: 'GitHub',
          icon: const FaIcon(FontAwesomeIcons.github,
              size: 20, color: AxiomColors.text),
          onTap: () => _open('https://github.com'),
        ),
        _Shortcut(
          label: 'Google',
          icon: const FaIcon(FontAwesomeIcons.google,
              size: 20, color: Color(0xFF4285F4)),
          onTap: () => _open('https://google.com'),
        ),
        _Shortcut(
          label: 'Notion',
          icon: const Text('N',
              style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: AxiomColors.text)),
          onTap: () => _open('https://notion.so'),
        ),
        _Shortcut(
          label: 'Add',
          icon: const FaIcon(FontAwesomeIcons.plus,
              size: 20, color: AxiomColors.text),
          onTap: null,
        ),
      ],
    );
  }

  Widget _buildAiBadge() {
    return Material(
      color: AxiomColors.surface,
      shape: StadiumBorder(side: BorderSide(color: AxiomColors.border)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: _handleAiSearch,
        child: const Padding(
          padding: EdgeInsets.symmetric(horizontal: 18, vertical: 9),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              FaIcon(FontAwesomeIcons.wandMagicSparkles, size: 13),
              SizedBox(width: 8),
              Text('AI powered search', style: TextStyle(fontSize: 13)),
              SizedBox(width: 8),
              FaIcon(FontAwesomeIcons.arrowRight, size: 13),
            ],
          ),
        ),
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════
// Small widgets
// ═════════════════════════════════════════════════════════════════════

class _TabItem extends StatelessWidget {
  final BrowserTab tab;
  final VoidCallback onTap;
  final VoidCallback onClose;

  const _TabItem({required this.tab, required this.onTap, required this.onClose});

  @override
  Widget build(BuildContext context) {
    final fg = tab.active ? AxiomColors.text : AxiomColors.textMuted;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 160,
        height: 34,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: tab.active ? AxiomColors.surfaceActive : AxiomColors.surface,
          border: Border(
            top: BorderSide(color: AxiomColors.border),
            left: BorderSide(color: AxiomColors.border),
            right: BorderSide(color: AxiomColors.border),
          ),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
        ),
        child: Row(
          children: [
            FaIcon(FontAwesomeIcons.globe, size: 12, color: fg),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                tab.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  color: fg,
                  fontWeight: tab.active ? FontWeight.w500 : FontWeight.normal,
                ),
              ),
            ),
            const SizedBox(width: 8),
            _RoundButton(
              size: 18,
              icon: FontAwesomeIcons.xmark,
              iconSize: 10,
              tooltip: 'Close Tab',
              color: AxiomColors.textMuted,
              onPressed: onClose,
            ),
          ],
        ),
      ),
    );
  }
}

class _Sidebar extends StatelessWidget {
  final bool narrow;
  const _Sidebar({required this.narrow});

  @override
  Widget build(BuildContext context) {
    const items = [
      (FontAwesomeIcons.house, 'Home', true),
      (FontAwesomeIcons.clockRotateLeft, 'History', false),
      (FontAwesomeIcons.solidBookmark, 'Bookmarks', false),
      (FontAwesomeIcons.download, 'Downloads', false),
      (FontAwesomeIcons.gear, 'Settings', false),
    ];

    return Container(
      width: narrow ? 72 : 240,
      padding: EdgeInsets.symmetric(horizontal: narrow ? 8 : 14, vertical: 20),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.18),
        border: Border(right: BorderSide(color: AxiomColors.border)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            children: [
              for (final it in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: _NavItem(
                    icon: it.$1,
                    label: it.$2,
                    active: it.$3,
                    narrow: narrow,
                  ),
                ),
            ],
          ),
          _WeatherCard(narrow: narrow),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final FaIconData icon;
  final String label;
  final bool active;
  final bool narrow;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.active,
    required this.narrow,
  });

  @override
  Widget build(BuildContext context) {
    final fg = active ? AxiomColors.text : AxiomColors.textMuted;
    return Material(
      color: active ? AxiomColors.surfaceActive : Colors.transparent,
      borderRadius: BorderRadius.circular(AxiomColors.radius),
      child: InkWell(
        borderRadius: BorderRadius.circular(AxiomColors.radius),
        hoverColor: AxiomColors.surfaceHover,
        onTap: () {},
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          child: Row(
            mainAxisAlignment:
            narrow ? MainAxisAlignment.center : MainAxisAlignment.start,
            children: [
              SizedBox(
                width: 20,
                child: Center(child: FaIcon(icon, size: 16, color: fg)),
              ),
              if (!narrow) ...[
                const SizedBox(width: 14),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 15,
                    color: fg,
                    fontWeight: active ? FontWeight.w600 : FontWeight.normal,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _WeatherCard extends StatelessWidget {
  final bool narrow;
  const _WeatherCard({required this.narrow});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: narrow ? 4 : 16, vertical: 14),
      decoration: BoxDecoration(
        color: AxiomColors.surface,
        border: Border.all(color: AxiomColors.border),
        borderRadius: BorderRadius.circular(AxiomColors.radius),
      ),
      child: Row(
        mainAxisAlignment:
        narrow ? MainAxisAlignment.center : MainAxisAlignment.start,
        children: [
          FaIcon(FontAwesomeIcons.cloudSun,
              size: narrow ? 20 : 26, color: const Color(0xFFFDE047)),
          if (!narrow) ...[
            const SizedBox(width: 14),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('24°C',
                    style:
                    TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                Text('Cairo, Egypt',
                    style:
                    TextStyle(fontSize: 12, color: AxiomColors.textMuted)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Shortcut extends StatelessWidget {
  final String label;
  final Widget icon;
  final VoidCallback? onTap;

  const _Shortcut({required this.label, required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 58,
            height: 58,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AxiomColors.surface,
              border: Border.all(color: AxiomColors.border),
              borderRadius: BorderRadius.circular(18),
            ),
            child: icon,
          ),
          const SizedBox(height: 8),
          Text(label, style: const TextStyle(fontSize: 13)),
        ],
      ),
    );
  }
}

class _RoundButton extends StatelessWidget {
  final double size;
  final FaIconData icon;
  final double iconSize;
  final String tooltip;
  final Color color;
  final Color? background;
  final VoidCallback onPressed;

  const _RoundButton({
    required this.size,
    required this.icon,
    required this.iconSize,
    required this.tooltip,
    required this.onPressed,
    this.color = AxiomColors.text,
    this.background,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: background ?? Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          hoverColor: AxiomColors.surfaceHover,
          onTap: onPressed,
          child: SizedBox(
            width: size,
            height: size,
            child: Center(child: FaIcon(icon, size: iconSize, color: color)),
          ),
        ),
      ),
    );
  }
}