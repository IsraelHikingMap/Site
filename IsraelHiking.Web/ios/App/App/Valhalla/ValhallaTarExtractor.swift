import Compression
import Foundation

enum ValhallaTarError: Error {
    case tarNotFound(String)
    case invalidHeader
    case invalidGzipHeader
    case entryOutsideDirectory(String)
}

/**
 * Reads the contents of a gzipped file as they are asked for, so that neither the file nor what it
 * holds is ever held in memory - an area is hundreds of megabytes packed and more than that unpacked.
 *
 * The compression framework's zlib is raw deflate, which is what a gzip file holds between its header
 * and its trailer, so the header is read here and the trailer, which is only a checksum and a length,
 * is simply never asked for.
 */
private final class GzipReader {
    private static let compressedChunkSize = 1 << 16
    private static let decompressedChunkSize = 1 << 20

    private let handle: FileHandle
    private var filter: InputFilter<Data>!
    private var pending = Data()

    init(url: URL) throws {
        handle = try FileHandle(forReadingFrom: url)
        try skipHeader()
        filter = try InputFilter(.decompress, using: .zlib) { [handle] length in
            try handle.read(upToCount: min(length, GzipReader.compressedChunkSize))
        }
    }

    func close() {
        try? handle.close()
    }

    /**
     * The next bytes of the file, as many as were asked for and fewer only at its end, where nil says
     * that there is nothing left.
     */
    func read(count: Int) throws -> Data? {
        while pending.count < count {
            guard let chunk = try filter.readData(ofLength: GzipReader.decompressedChunkSize), !chunk.isEmpty else {
                break
            }
            pending.append(chunk)
        }
        guard !pending.isEmpty else {
            return nil
        }
        let taken = Data(pending.prefix(count))
        pending = pending.dropFirst(taken.count)
        return taken
    }

    /**
     * Passes over the next bytes, which a compressed file can only do by reading them.
     */
    func skip(_ count: Int) throws {
        var remaining = count
        while remaining > 0 {
            guard let chunk = try read(count: min(remaining, GzipReader.decompressedChunkSize)), !chunk.isEmpty else {
                return
            }
            remaining -= chunk.count
        }
    }

    /**
     * Reads past the gzip header, which is ten bytes and then whatever its flags say it also carries.
     */
    private func skipHeader() throws {
        guard let header = try handle.read(upToCount: 10), header.count == 10,
              header[0] == 0x1F, header[1] == 0x8B, header[2] == 8 else {
            throw ValhallaTarError.invalidGzipHeader
        }
        let flags = header[3]
        if flags & 0b0000_0100 != 0 { // An extra field, of the length that comes before it
            guard let length = try handle.read(upToCount: 2), length.count == 2 else {
                throw ValhallaTarError.invalidGzipHeader
            }
            _ = try handle.read(upToCount: Int(length[0]) | Int(length[1]) << 8)
        }
        for flag in [UInt8(0b0000_1000), UInt8(0b0001_0000)] { // The original name and a comment, null terminated
            guard flags & flag != 0 else {
                continue
            }
            while let byte = try handle.read(upToCount: 1), byte.count == 1, byte[0] != 0 {
                continue
            }
        }
        if flags & 0b0000_0010 != 0 { // A checksum of the header itself
            _ = try handle.read(upToCount: 2)
        }
    }
}

/**
 * A minimal streaming reader for the gzipped tar files that hold the routing tiles, mirroring what
 * commons-compress does on android. It is streaming on purpose - an area can be hundreds of megabytes,
 * so neither the archive nor a single tile is ever held in memory.
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
     * Extracts the archive into the given directory and returns the relative paths of the files it wrote.
     * An entry whose name would escape the tiles directory is rejected. An archive that was packed from
     * within a directory names that directory itself first, which is the one entry that is allowed to be
     * the tiles directory rather than something under it.
     * What is returned is where each file ended up rather than how the archive spelled it, so that an
     * archive packed as "./0/002/753.gph" and one packed as "0/002/753.gph" leave the same manifest
     * behind - it is what the tiles are deleted by later on.
     */
    static func extract(archiveAt archiveURL: URL, into directoryURL: URL) throws -> [String] {
        let fileManager = FileManager.default
        guard fileManager.fileExists(atPath: archiveURL.path) else {
            throw ValhallaTarError.tarNotFound(archiveURL.path)
        }
        try fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        let directoryPath = directoryURL.standardizedFileURL.path

        let reader = try GzipReader(url: archiveURL)
        defer { reader.close() }

        var paths: [String] = []
        while true {
            guard let header = try reader.read(count: blockSize), header.count == blockSize else {
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
            guard entryURL.path == directoryPath || entryURL.path.hasPrefix(directoryPath + "/") else {
                throw ValhallaTarError.entryOutsideDirectory(entryName)
            }

            let isDirectory = typeFlag == UInt8(ascii: "5") || entryName.hasSuffix("/")
            let isFile = typeFlag == UInt8(ascii: "0") || typeFlag == 0

            if isDirectory {
                try fileManager.createDirectory(at: entryURL, withIntermediateDirectories: true)
            } else if isFile {
                try fileManager.createDirectory(at: entryURL.deletingLastPathComponent(), withIntermediateDirectories: true)
                try write(from: reader, byteCount: size, to: entryURL)
                paths.append(String(entryURL.path.dropFirst(directoryPath.count + 1)))
            } else {
                // Long names, pax headers and links are not produced by valhalla's extracts
                try reader.skip(size)
            }
            // Entries are padded to a whole number of blocks
            let padding = (blockSize - size % blockSize) % blockSize
            if padding > 0 {
                try reader.skip(padding)
            }
        }
        return paths
    }

    private static func write(from reader: GzipReader, byteCount: Int, to url: URL) throws {
        FileManager.default.createFile(atPath: url.path, contents: nil)
        let outputHandle = try FileHandle(forWritingTo: url)
        defer { try? outputHandle.close() }

        var remaining = byteCount
        while remaining > 0 {
            let chunkSize = min(remaining, copyBufferSize)
            guard let chunk = try reader.read(count: chunkSize), !chunk.isEmpty else {
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
