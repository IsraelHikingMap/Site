# Stack traces from play console are only readable through the mapping file that is built
# alongside the bundle, and only if the line numbers survive to be mapped back. The source file
# names are renamed rather than kept, so they carry nothing but the line number.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
