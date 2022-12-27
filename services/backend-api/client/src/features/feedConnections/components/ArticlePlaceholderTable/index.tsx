import {
  Box,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

interface Props {
  article: Record<string, string>
}

export const ArticlePlaceholderTable = ({ article }: Props) => {
  const { t } = useTranslation();

  return (
    <Box>

      <Box
        position="relative"
        border="solid 1px"
        borderColor="gray.600"
        borderRadius="md"
      >
        <Box
          maxHeight="sm"
          overflow="auto"
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>
                    {t('features.feedConnections.components'
                    + '.articlePlaceholderTable.columnHeaderPlaceholder')}
                  </Th>
                  <Th>
                    {t('features.feedConnections.components'
                    + '.articlePlaceholderTable.columnHeaderPlaceholder')}
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {Object.entries(article).map(([key, value]) => (
                  <Tr key={key}>
                    <Td>{key}</Td>
                    <Td>{value}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
    </Box>
  );
};
