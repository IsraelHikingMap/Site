import Foundation

enum ValhallaTarError: Error {
    case tarNotFound(String)
    case invalidHeader
    case entryOutsideDirectory(String)
}

/**
 * A minimal streaming reader for the uncompressed tar files that hold the routing tiles, mirroring
 * what commons-compress does on android. It is streaming on purpose - an area can be hundreds of
 * megabytes, so neither the archive nor a single tile is ever held in memory.
 *
 * Only what valhalla's extracts contain is handled: regular files and directories, with the plain
 * ustar header. Anything else is skipped rather than guessed at.
 */
enum ValhallaTarExtractor {
    private static let blockSize = 512
    private static let copyBufferSize = 1 << 20

    private enum Field {
        static let name = (offset: 0, length: 100)
        static let size = (offset: 124, length: 12)
        static let typeFlag = 156
        static let prefix = (offset: 345, length: 155)
    }

    /**
     * Extracts the tar into the given directory and returns the relative paths of the files it wrote.
     */
    static func extract(tarAt tarURL: URL, into directoryURL: URL) throws -> [String] {
        let fileManager = FileManager.default
        guard fileManager.fileExists(atPath: tarURL.path) else {
            throw ValhallaTarError.tarNotFound(tarURL.path)
        }
        try fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        let directoryPath = directoryURL.standardizedFileURL.path

        let handle = try FileHandle(forReadingFrom: tarURL)
        defer { try? handle.close() }

        var paths: [String] = []
        while true {
            guard let header = try handle.read(upToCount: blockSize), header.count == blockSize else {
                break
            }
            // The archive ends with empty blocks
            if header.allSatisfy({ $0 == 0 }) {
                break
            }
            let name = string(in: header, at: Field.name.offset, length: Field.name.length)
            if name.isEmpty {
                break
            }
            let prefix = string(in: header, at: Field.prefix.offset, length: Field.prefix.length)
            let entryName = prefix.isEmpty ? name : "\(prefix)/\(name)"
            let sizeField = string(in: header, at: Field.size.offset, length: Field.size.length)
            guard let size = Int(sizeField, radix: 8) else {
                throw ValhallaTarError.invalidHeader
            }
            let typeFlag = header[Field.typeFlag]

            let entryURL = directoryURL.appendingPathComponent(entryName).standardizedFileURL
            // Do not let an entry name escape the tiles directory
            guard entryURL.path.hasPrefix(directoryPath + "/") else {
                throw ValhallaTarError.entryOutsideDirectory(entryName)
            }

            let isDirectory = typeFlag == UInt8(ascii: "5") || entryName.hasSuffix("/")
            let isFile = typeFlag == UInt8(ascii: "0") || typeFlag == 0

            if isDirectory {
                try fileManager.createDirectory(at: entryURL, withIntermediateDirectories: true)
            } else if isFile {
                try fileManager.createDirectory(at: entryURL.deletingLastPathComponent(), withIntermediateDirectories: true)
                try write(from: handle, byteCount: size, to: entryURL)
                paths.append(entryName)
            } else {
                // Long names, pax headers and links are not produced by valhalla's extracts
                try handle.seek(toOffset: handle.offset() + UInt64(size))
            }
            // Entries are padded to a whole number of blocks
            let padding = (blockSize - size % blockSize) % blockSize
            if padding > 0 {
                try handle.seek(toOffset: handle.offset() + UInt64(padding))
            }
        }
        return paths
    }

    private static func write(from handle: FileHandle, byteCount: Int, to url: URL) throws {
        FileManager.default.createFile(atPath: url.path, contents: nil)
        let outputHandle = try FileHandle(forWritingTo: url)
        defer { try? outputHandle.close() }

        var remaining = byteCount
        while remaining > 0 {
            let chunkSize = min(remaining, copyBufferSize)
            guard let chunk = try handle.read(upToCount: chunkSize), !chunk.isEmpty else {
                throw ValhallaTarError.invalidHeader
            }
            try outputHandle.write(contentsOf: chunk)
            remaining -= chunk.count
        }
    }

    /**
     * Reads a null padded, and possibly space padded, ascii field out of a header block.
     */
    private static func string(in header: Data, at offset: Int, length: Int) -> String {
        let field = header.subdata(in: offset..<(offset + length))
        let value = field.prefix { $0 != 0 }
        return String(decoding: value, as: UTF8.self).trimmingCharacters(in: .whitespaces)
    }
}
