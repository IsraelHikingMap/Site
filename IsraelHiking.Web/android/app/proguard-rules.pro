# Stack traces from play console are only readable through the mapping file that is built
# alongside the bundle, and only if the line numbers survive to be mapped back. The source file
# names are renamed rather than kept, so they carry nothing but the line number.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# pmtiles-mobile and maplibre-contour-rs are uniffi generated bindings that reach their rust
# libraries through JNA, and neither aar ships rules of its own. JNA lays out a native struct by
# reflecting over the field names and declared order of the Structure that mirrors it, and finds a
# Callback by its method name, so renaming either leaves it reading a buffer at the wrong offsets
# or unable to dispatch a call back from rust - at runtime, with nothing said at build time. The
# generated bindings are the whole of these two packages, so they are kept whole.
-keep class com.mapeak.pmtiles.** { *; }
-keep class com.mapeak.maplibrecontour.** { *; }
-keep class com.sun.jna.** { *; }
-keepclassmembers class * extends com.sun.jna.Structure { <fields>; }
-keepclassmembers class * implements com.sun.jna.Callback { <methods>; }

# JNA is written to run on the desktop as well, where it draws on awt to describe native windows.
# None of that is reachable on android, but R8 still reads the references and asks about them.
-dontwarn java.awt.**
