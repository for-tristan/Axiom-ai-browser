import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'theme.dart';
import 'website_page.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  SystemChrome.setSystemUIOverlayStyle(
    SystemUiOverlayStyle.light,
  );

  runApp(const AxiomApp());
}

class AxiomApp extends StatelessWidget {
  const AxiomApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Axiom Browser',
      debugShowCheckedModeBanner: false,

      theme: ThemeData(
        brightness: Brightness.dark,
        useMaterial3: true,
        scaffoldBackgroundColor: AxiomColors.bgTop,
        colorScheme: const ColorScheme.dark(
          primary: AxiomColors.accent,
        ),
        textTheme: ThemeData.dark().textTheme.apply(
          bodyColor: AxiomColors.text,
          displayColor: AxiomColors.text,
        ),
      ),

      home: const WebsitePage(),
    );
  }
}

// adding ahmed and engy to the author 