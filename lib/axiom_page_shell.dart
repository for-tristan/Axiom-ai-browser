import 'package:flutter/material.dart';

import 'theme.dart';

/// هيكل مشترك لصفحات History وBookmarks وProfile (نفس الخلفية والألوان).
class AxiomPageShell extends StatelessWidget {
  const AxiomPageShell({
    super.key,
    required this.title,
    required this.icon,
    required this.child,
    this.actions = const [],
  });

  final String title;
  final IconData icon;
  final Widget child;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment(-0.34, -1),
            end: Alignment(0.34, 1),
            colors: [AxiomColors.bgTop, AxiomColors.bgBottom],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _header(context),
              Expanded(child: child),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.22),
        border: Border(bottom: BorderSide(color: AxiomColors.border)),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Back',
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.arrow_back, size: 20),
          ),
          Icon(icon, size: 18, color: AxiomColors.accent),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
          ),
          ...actions,
        ],
      ),
    );
  }
}

/// كارت بنفس شكل كروت صفحة الإجابة.
class AxiomCard extends StatelessWidget {
  const AxiomCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(14),
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: AxiomColors.surface,
        shape: RoundedRectangleBorder(
          side: BorderSide(color: AxiomColors.border),
          borderRadius: BorderRadius.circular(AxiomColors.radius),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(AxiomColors.radius),
          onTap: onTap,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

/// حالة "مفيش حاجة هنا".
class AxiomEmptyState extends StatelessWidget {
  const AxiomEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AxiomColors.surfaceActive,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, size: 24, color: AxiomColors.accent),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: AxiomColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}

/// دايرة فيها أول حرف من اسم الموقع.
class SiteBadge extends StatelessWidget {
  const SiteBadge({super.key, required this.title, required this.url});

  final String title;
  final String url;

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: 16,
      backgroundColor: AxiomColors.surfaceActive,
      child: Text(
        siteInitial(title, url),
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
      ),
    );
  }
}

String displayHost(String url) {
  final host = Uri.tryParse(url)?.host ?? '';
  if (host.isEmpty) return url;
  return host.startsWith('www.') ? host.substring(4) : host;
}

String siteInitial(String title, String url) {
  final host = displayHost(url);
  final source = host.isNotEmpty ? host : title;
  return source.isEmpty ? '?' : source.substring(0, 1).toUpperCase();
}

String _two(int n) => n.toString().padLeft(2, '0');

String formatTime(DateTime t) => '${_two(t.hour)}:${_two(t.minute)}';

String dayLabel(DateTime t) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(t.year, t.month, t.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  return '${_two(t.day)}/${_two(t.month)}/${t.year}';
}
